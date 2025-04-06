from flask import Flask, request, jsonify, render_template, send_from_directory
import os
import pandas as pd
import time
import uuid
from werkzeug.utils import secure_filename
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import threading
import urllib.parse
import re
import csv
import io
import logging
from urllib.parse import quote
import datetime

app = Flask(__name__, static_folder='static')

# Configuration
UPLOAD_FOLDER = 'uploads'
ALLOWED_BROCHURE_EXTENSIONS = {'pdf', 'jpg', 'jpeg', 'png', 'docx', 'xlsx', 'zip', 'ppt', 'pptx', 'txt', 'mp4', 'gif'}
ALLOWED_EXCEL_EXTENSIONS = {'xlsx', 'xls', 'csv'}
MAX_CONTENT_LENGTH = 20 * 1024 * 1024  # 20MB limit
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = MAX_CONTENT_LENGTH
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev_key_for_testing')

# Global variables to track messaging state
sending_status = {
    'is_sending': False,
    'total': 0,
    'current': 0,
    'success': 0,
    'failed': 0,
    'numbers': [],
    'cancel_requested': False
}

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Helper functions for file handling
def allowed_brochure_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_BROCHURE_EXTENSIONS

def allowed_excel_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXCEL_EXTENSIONS

def get_file_url(filename):
    host_url = request.host_url.rstrip('/')
    return f"{host_url}/uploads/{filename}"

def extract_valid_phone_numbers(file_path):
    """Extract valid phone numbers from Excel or CSV file"""
    try:
        # Determine file type
        file_extension = os.path.splitext(file_path)[1].lower()
        
        if file_extension == '.csv':
            # For CSV files
            df = pd.read_csv(file_path)
        else:
            # For Excel files
            df = pd.read_excel(file_path)
        
        # Try to find columns that might contain phone numbers
        potential_phone_columns = []
        for col in df.columns:
            # Check column name for keywords
            if any(keyword in col.lower() for keyword in ['phone', 'mobile', 'cell', 'tel', 'contact', 'number']):
                potential_phone_columns.append(col)
        
        # If no potential columns found by name, try to identify by content
        if not potential_phone_columns:
            for col in df.columns:
                # Sample the first 10 non-NaN values or less if fewer exist
                sample_values = df[col].dropna().head(10)
                
                # Check if at least 70% of the sample could be phone numbers
                matches = 0
                for val in sample_values:
                    # Convert to string and check if it could be a phone number
                    str_val = str(val)
                    if re.search(r'^\+?[0-9\s\-\(\)]{7,15}$', str_val.strip()):
                        matches += 1
                
                if sample_values.shape[0] > 0 and matches / sample_values.shape[0] >= 0.7:
                    potential_phone_columns.append(col)
        
        # Extract phone numbers from the identified columns
        phone_numbers = []
        for col in potential_phone_columns:
            for val in df[col]:
                if pd.notna(val):  # Skip NaN values
                    str_val = str(val).strip()
                    # Clean the phone number: remove spaces, dashes, brackets
                    cleaned = re.sub(r'[\s\-\(\)]', '', str_val)
                    # Ensure it starts with a plus or country code
                    if not cleaned.startswith('+'):
                        # If no plus, add one if it doesn't start with country code
                        if not cleaned.startswith(('1', '2', '3', '4', '5', '6', '7', '8', '9')):
                            cleaned = '+' + cleaned
                    
                    # Validate format with a more permissive regex
                    if re.match(r'^\+?[0-9]{7,15}$', cleaned):
                        phone_numbers.append(cleaned)
        
        # If still no numbers found, try a more aggressive approach on all string columns
        if not phone_numbers:
            for col in df.columns:
                if df[col].dtype == 'object':  # Only check string/object columns
                    for val in df[col]:
                        if pd.notna(val):
                            str_val = str(val).strip()
                            # Extract anything that looks like a phone number
                            matches = re.findall(r'(?:\+?[0-9]{1,3})?[0-9]{7,12}', re.sub(r'[\s\-\(\)]', '', str_val))
                            for match in matches:
                                if len(match) >= 7:  # Minimum length for phone number
                                    phone_numbers.append(match)
        
        # Remove duplicates and ensure proper formatting
        unique_phones = []
        seen = set()
        for phone in phone_numbers:
            # Standardize: make sure it starts with "+"
            if not phone.startswith('+'):
                phone = '+' + phone
            
            if phone not in seen:
                seen.add(phone)
                unique_phones.append(phone)
        
        return unique_phones
    
    except Exception as e:
        logger.error(f"Error extracting phone numbers: {str(e)}")
        return []

def format_phone_for_display(phone):
    """Format phone number for display purposes"""
    # Simple formatting with country code and then groups of digits
    if phone.startswith('+'):
        phone = phone[1:]  # Remove the plus sign
    
    # Get country code (first 1-3 digits)
    if len(phone) >= 7:
        if phone.startswith('1'):  # US/Canada
            country_code = phone[:1]
            local_number = phone[1:]
        else:
            country_code = phone[:min(3, len(phone)-7)]  # Take up to 3 digits for country code
            local_number = phone[min(3, len(phone)-7):]
    else:
        # For very short numbers, don't try to parse country code
        country_code = ""
        local_number = phone
    
    # Format: +[country_code] [local_number with spaces]
    formatted = f"+{country_code} {' '.join([local_number[i:i+4] for i in range(0, len(local_number), 4)])}"
    return formatted.strip()

def send_whatsapp_messages(numbers, message, brochure_url):
    """Send WhatsApp messages using Selenium"""
    # Reset status
    sending_status['is_sending'] = True
    sending_status['total'] = len(numbers)
    sending_status['current'] = 0
    sending_status['success'] = 0
    sending_status['failed'] = 0
    sending_status['numbers'] = numbers
    sending_status['cancel_requested'] = False
    
    # Set up Chrome WebDriver
    chrome_options = Options()
    # Uncomment these lines if you want to run in headless mode
    # chrome_options.add_argument("--headless")
    # chrome_options.add_argument("--window-size=1920,1080")
    chrome_options.add_argument("--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36")
    chrome_options.add_argument("--disable-notifications")
    
    try:
        driver = webdriver.Chrome(options=chrome_options)
        
        # Add brochure URL to message
        full_message = f"{message}\n\nView brochure: {brochure_url}"
        encoded_message = urllib.parse.quote(full_message)
        
        # Send messages one by one
        for i, number in enumerate(numbers):
            if sending_status['cancel_requested']:
                break
                
            try:
                # Construct WhatsApp URL
                whatsapp_url = f"https://wa.me/{number}?text={encoded_message}"
                
                # Open WhatsApp Web
                driver.get(whatsapp_url)
                
                # Wait for continue to chat button and click it
                continue_btn = WebDriverWait(driver, 10).until(
                    EC.element_to_be_clickable((By.XPATH, "//a[contains(@id, 'action-button')]"))
                )
                continue_btn.click()
                
                # Wait for use WhatsApp Web button and click it
                use_web_btn = WebDriverWait(driver, 10).until(
                    EC.element_to_be_clickable((By.XPATH, "//a[contains(text(), 'use WhatsApp Web')]"))
                )
                use_web_btn.click()
                
                # Wait for send button and click it
                send_btn = WebDriverWait(driver, 30).until(
                    EC.element_to_be_clickable((By.XPATH, "//span[@data-icon='send']"))
                )
                send_btn.click()
                
                # Update status
                sending_status['current'] = i + 1
                sending_status['success'] += 1
                
                # Wait between messages to avoid being flagged
                time.sleep(5)
                
            except Exception as e:
                print(f"Error sending to {number}: {e}")
                sending_status['failed'] += 1
                sending_status['current'] = i + 1
        
    except Exception as e:
        print(f"Browser automation error: {e}")
    finally:
        # Clean up
        try:
            driver.quit()
        except:
            pass
        
        sending_status['is_sending'] = False

# Routes
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

@app.route('/upload-brochure', methods=['POST'])
def upload_brochure():
    if 'brochure' not in request.files:
        return jsonify({'success': False, 'error': 'No file uploaded'})
    
    file = request.files['brochure']
    
    if file.filename == '':
        return jsonify({'success': False, 'error': 'No file selected'})
    
    if not allowed_brochure_file(file.filename):
        return jsonify({'success': False, 'error': f'Invalid file format. Allowed formats: {", ".join(ALLOWED_BROCHURE_EXTENSIONS)}'})
    
    try:
        # Generate a unique filename to prevent overwrites
        filename = secure_filename(file.filename)
        unique_filename = f"{uuid.uuid4()}_{filename}"
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
        
        # Save the file
        file.save(file_path)
        
        # Generate a URL for the file (in a real app, this might be a cloud storage URL)
        file_url = request.host_url + f'uploads/{unique_filename}'
        
        return jsonify({
            'success': True,
            'file': {
                'name': filename,
                'url': file_url,
                'size': os.path.getsize(file_path)
            }
        })
    
    except Exception as e:
        logger.error(f"Error uploading brochure: {str(e)}")
        return jsonify({'success': False, 'error': f'Error uploading file: {str(e)}'})

@app.route('/extract-numbers', methods=['POST'])
def extract_numbers():
    if 'excel' not in request.files:
        return jsonify({'success': False, 'error': 'No file uploaded'})
    
    file = request.files['excel']
    
    if file.filename == '':
        return jsonify({'success': False, 'error': 'No file selected'})
    
    if not allowed_excel_file(file.filename):
        return jsonify({'success': False, 'error': f'Invalid file format. Allowed formats: {", ".join(ALLOWED_EXCEL_EXTENSIONS)}'})
    
    try:
        # Save the file temporarily
        filename = secure_filename(file.filename)
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], f"{uuid.uuid4()}_{filename}")
        file.save(file_path)
        
        # Extract phone numbers
        phone_numbers = extract_valid_phone_numbers(file_path)
        
        # Remove the temp file
        os.remove(file_path)
        
        if not phone_numbers:
            return jsonify({'success': False, 'error': 'No valid phone numbers found in the file'})
        
        return jsonify({'success': True, 'numbers': phone_numbers})
    
    except Exception as e:
        logger.error(f"Error processing file: {str(e)}")
        return jsonify({'success': False, 'error': f'Error processing file: {str(e)}'})

@app.route('/generate-links', methods=['POST'])
def generate_links():
    data = request.get_json()
    
    if not data or 'numbers' not in data or 'message' not in data:
        return jsonify({'success': False, 'error': 'Missing required fields'})
    
    phone_numbers = data.get('numbers', [])
    message = data.get('message', '')
    brochure_url = data.get('brochureUrl', '')
    
    if not phone_numbers:
        return jsonify({'success': False, 'error': 'No phone numbers provided'})
    
    try:
        # Create WhatsApp links for each number
        links = []
        for number in phone_numbers:
            # Prepare message text with brochure URL if provided
            full_message = message
            if brochure_url:
                full_message += f"\n\nPlease check our brochure: {brochure_url}"
            
            # Encode message for URL
            encoded_message = quote(full_message)
            
            # Create WhatsApp link
            # Note: we're using the web WhatsApp API format
            whatsapp_link = f"https://wa.me/{number.lstrip('+').strip()}?text={encoded_message}"
            
            links.append({
                'number': number,
                'formattedNumber': format_phone_for_display(number),
                'url': whatsapp_link
            })
        
        return jsonify({'success': True, 'links': links})
    
    except Exception as e:
        logger.error(f"Error generating links: {str(e)}")
        return jsonify({'success': False, 'error': f'Error generating links: {str(e)}'})

@app.route('/send-messages', methods=['POST'])
def send_messages():
    # Check if already sending
    if sending_status['is_sending']:
        return jsonify({'error': 'Already sending messages'}), 400
    
    data = request.json
    
    if not data or 'numbers' not in data or 'message' not in data or 'brochureUrl' not in data:
        return jsonify({'error': 'Missing required fields'}), 400
    
    numbers = data['numbers']
    message = data['message']
    brochure_url = data['brochureUrl']
    
    if not numbers or not message or not brochure_url:
        return jsonify({'error': 'Numbers, message, and brochure URL are required'}), 400
    
    # Start sending in a background thread
    thread = threading.Thread(target=send_whatsapp_messages, 
                             args=(numbers, message, brochure_url))
    thread.daemon = True
    thread.start()
    
    return jsonify({'success': True, 'message': 'Started sending messages'})

@app.route('/status', methods=['GET'])
def get_status():
    return jsonify(sending_status)

@app.route('/cancel', methods=['POST'])
def cancel_sending():
    sending_status['cancel_requested'] = True
    return jsonify({'success': True, 'message': 'Cancellation requested'})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=3000, debug=True) 
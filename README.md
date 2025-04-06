# 🚀 WhatsApp Bulk Outreach + Brochure Sharing Tool

A web application to generate WhatsApp links and send messages efficiently to a list of contacts extracted from Excel or CSV files with brochure sharing capabilities.

## ✨ Features

- **📊 Excel/CSV Integration** - Upload Excel (.xlsx, .xls) or CSV files containing phone numbers
- **🔍 Smart Number Detection** - Automatically identifies columns containing phone numbers
- **🧹 Duplicate Removal** - Removes duplicate numbers automatically
- **✅ Number Validation** - Ensures numbers are in correct WhatsApp format
- **📝 Message Composer** - Create custom messages with brochure links
- **📎 Document Sharing** - Upload and share brochures in various formats (PDF, DOC, PPT, images, videos)
- **🔗 WhatsApp Link Generation** - Creates clickable links for each contact
- **📱 Batch Sending** - Opens links in batches to prevent browser blocking
- **💾 CSV Export** - Download all generated links as a CSV file
- **🌙 Dark Mode** - Toggle between light and dark themes for comfortable viewing
- **📱 Responsive UI** - Works on desktop and mobile devices

## 🚀 Getting Started

### Prerequisites

- Python 3.6 or higher
- Web browser (Chrome recommended)
- Internet connection
- WhatsApp account

### Installation

1. Clone this repository:
   ```
   git clone https://github.com/yourusername/whatsapp-bulk-outreach.git
   cd whatsapp-bulk-outreach
   ```

2. Create a virtual environment and activate it:
   ```
   # On Windows
   python -m venv venv
   venv\Scripts\activate

   # On macOS/Linux
   python3 -m venv venv
   source venv/bin/activate
   ```

3. Install dependencies:
   ```
   pip install -r requirements.txt
   ```

4. Copy the environment file and configure it:
   ```
   cp .env.example .env
   ```

5. Run the application:
   ```
   python app.py
   ```

6. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

## 📋 How to Use

1. **Upload Excel/CSV File**: Click on the upload area or drag and drop your file containing phone numbers.

2. **Compose Message**: Write your custom message in the text area.

3. **Upload Brochure**: Upload your brochure, document, or media file (PDF, DOC, PPT, images, videos).

4. **Generate Links**: Click the "Generate WhatsApp Links" button to process the numbers and create WhatsApp links.

5. **Send Messages**: Use the "Send All (Batched)" button to open WhatsApp links in batches, or click individual "Send" buttons.

6. **Export Data**: Download the generated links as a CSV file for future use.

## ⚠️ Important Notes

- The application does not store or send your contacts or messages to any third-party servers.
- WhatsApp has rate limits - sending too many messages too quickly may result in temporary blocks.
- For larger campaigns, use the batch sending feature with reasonable delays.
- First-time use requires scanning the WhatsApp QR code.

## 🔒 Privacy

This tool respects user privacy:
- All data processing happens locally in your browser
- No external API calls for message sending
- No data collection or tracking

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgements

- [Flask](https://flask.palletsprojects.com/) - Web framework
- [Pandas](https://pandas.pydata.org/) - Data processing
- [TailwindCSS](https://tailwindcss.com/) - Styling

---

Made with ❤️ to simplify WhatsApp business outreach 
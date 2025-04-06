document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const darkModeToggle = document.getElementById('darkModeToggle');
    const darkModeIcon = document.getElementById('darkModeIcon');
    const darkModeText = document.getElementById('darkModeText');
    
    // Excel Upload Elements
    const dropZone = document.getElementById('dropZone');
    const excelFileInput = document.getElementById('excelFile');
    const fileDetails = document.getElementById('fileDetails');
    const fileError = document.getElementById('fileError');
    const errorMessage = document.getElementById('errorMessage');
    const fileName = document.getElementById('fileName');
    const numberCount = document.getElementById('numberCount');
    const removeFileBtn = document.getElementById('removeFile');
    
    // Brochure Upload Elements
    const brochureDropZone = document.getElementById('brochureDropZone');
    const brochureFileInput = document.getElementById('brochureFile');
    const uploadProgress = document.getElementById('uploadProgress');
    const progressBar = document.getElementById('progressBar');
    const uploadStatus = document.getElementById('uploadStatus');
    const brochureDetails = document.getElementById('brochureDetails');
    const brochureName = document.getElementById('brochureName');
    const brochureSize = document.getElementById('brochureSize');
    const removeBrochureBtn = document.getElementById('removeBrochure');
    const brochurePreview = document.getElementById('brochurePreview');
    const previewContent = document.getElementById('previewContent');
    
    // Message Elements
    const messageText = document.getElementById('messageText');
    const messagePreview = document.getElementById('messagePreview');
    const generateLinksBtn = document.getElementById('generateLinks');
    
    // Results Elements
    const resultsSection = document.getElementById('resultsSection');
    const resultsTable = document.getElementById('resultsTable');
    const totalNumbers = document.getElementById('totalNumbers');
    const downloadCSVBtn = document.getElementById('downloadCSV');
    const openAllLinksBtn = document.getElementById('openAllLinks');

    // State variables
    let phoneNumbers = [];
    let isDarkMode = false;
    let excelFileUploaded = false;
    let brochureFileUploaded = false;
    let brochureUrl = '';
    let whatsappLinks = [];

    // Check for dark mode preference
    if (localStorage.getItem('darkMode') === 'true' || 
        (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches && localStorage.getItem('darkMode') === null)) {
        enableDarkMode();
    }

    // Initialize button state
    updateGenerateButtonState();
    updateMessagePreview();

    // Event Listeners
    darkModeToggle.addEventListener('click', toggleDarkMode);
    
    // Excel file handling
    excelFileInput.addEventListener('change', handleExcelFileSelect);
    removeFileBtn.addEventListener('click', removeExcelFile);
    
    // Brochure file handling
    brochureFileInput.addEventListener('change', handleBrochureFileSelect);
    removeBrochureBtn.addEventListener('click', removeBrochureFile);
    
    // Message and results handling
    messageText.addEventListener('input', () => {
        updateMessagePreview();
        updateGenerateButtonState();
    });
    generateLinksBtn.addEventListener('click', generateWhatsAppLinks);
    downloadCSVBtn.addEventListener('click', downloadCSV);
    openAllLinksBtn.addEventListener('click', openAllLinks);

    // Excel Drop Zone handling
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        
        if (e.dataTransfer.files.length > 0) {
            handleExcelFile(e.dataTransfer.files[0]);
        }
    });
    
    // Brochure Drop Zone handling
    brochureDropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        brochureDropZone.classList.add('drag-over');
    });

    brochureDropZone.addEventListener('dragleave', () => {
        brochureDropZone.classList.remove('drag-over');
    });

    brochureDropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        brochureDropZone.classList.remove('drag-over');
        
        if (e.dataTransfer.files.length > 0) {
            handleBrochureFile(e.dataTransfer.files[0]);
        }
    });

    // Functions
    function toggleDarkMode() {
        if (isDarkMode) {
            disableDarkMode();
        } else {
            enableDarkMode();
        }
    }

    function enableDarkMode() {
        document.documentElement.classList.add('dark');
        darkModeIcon.textContent = '☀️';
        darkModeText.textContent = 'Light Mode';
        isDarkMode = true;
        localStorage.setItem('darkMode', 'true');
    }

    function disableDarkMode() {
        document.documentElement.classList.remove('dark');
        darkModeIcon.textContent = '🌙';
        darkModeText.textContent = 'Dark Mode';
        isDarkMode = false;
        localStorage.setItem('darkMode', 'false');
    }

    // Excel File Handling
    function handleExcelFileSelect(e) {
        const file = e.target.files[0];
        if (file) {
            handleExcelFile(file);
        }
    }

    function handleExcelFile(file) {
        // Check if file is Excel
        if (!file.name.match(/\.(xlsx|xls)$/i)) {
            showExcelError('Invalid file format. Only Excel files (.xlsx, .xls) are supported.');
            return;
        }

        // Reset previous data
        phoneNumbers = [];
        excelFileUploaded = false;
        
        // Show loading state
        fileDetails.classList.remove('hidden');
        fileName.textContent = file.name;
        numberCount.innerHTML = '<div class="spinner mr-2"></div> Processing...';
        fileError.classList.add('hidden');
        
        // Read the Excel file
        const reader = new FileReader();
        
        reader.onload = function(e) {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                
                // Get the first sheet
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                
                // Convert to JSON
                const jsonData = XLSX.utils.sheet_to_json(worksheet);
                
                if (jsonData.length === 0) {
                    showExcelError('The Excel file is empty or contains no data.');
                    return;
                }
                
                // Extract phone numbers
                extractPhoneNumbers(jsonData);
                
                if (phoneNumbers.length === 0) {
                    showExcelError('No valid phone numbers found in the Excel file.');
                    return;
                }
                
                // Update UI
                excelFileUploaded = true;
                numberCount.textContent = `${phoneNumbers.length} numbers found`;
                updateGenerateButtonState();
                
            } catch (error) {
                console.error(error);
                showExcelError('Error processing the Excel file. Please check the file format.');
            }
        };
        
        reader.onerror = function() {
            showExcelError('Error reading the file. Please try again.');
        };
        
        reader.readAsArrayBuffer(file);
    }

    function extractPhoneNumbers(data) {
        // Common column names for phone numbers
        const possibleColumnNames = [
            'phone', 'mobile', 'contact', 'number', 'cell', 'telephone', 'tel', 
            'phone number', 'mobile number', 'contact number', 'cell number',
            'phonenumber', 'mobilenumber', 'contactnumber', 'cellnumber',
            'phone_number', 'mobile_number', 'contact_number', 'cell_number'
        ];
        
        // Try to find a column with phone numbers
        let phoneColumn = null;
        
        // Try all possible column names (case insensitive)
        for (const item of data) {
            const keys = Object.keys(item);
            
            for (const key of keys) {
                const lowerKey = key.toLowerCase();
                if (possibleColumnNames.includes(lowerKey)) {
                    phoneColumn = key;
                    break;
                }
            }
            
            if (phoneColumn) break;
        }
        
        // If no standard column name found, try to detect number patterns in all columns
        if (!phoneColumn) {
            const columns = Object.keys(data[0] || {});
            
            for (const column of columns) {
                // Check if at least 60% of the values in this column are phone numbers
                const numberCount = data.filter(item => {
                    const value = String(item[column] || '');
                    return isValidPhoneNumber(value);
                }).length;
                
                if (numberCount / data.length >= 0.6) {
                    phoneColumn = column;
                    break;
                }
            }
        }
        
        // If still no column found, try all columns for each row
        if (!phoneColumn) {
            for (const item of data) {
                for (const key in item) {
                    const value = String(item[key] || '');
                    if (isValidPhoneNumber(value)) {
                        const cleanNumber = cleanPhoneNumber(value);
                        if (!phoneNumbers.includes(cleanNumber)) {
                            phoneNumbers.push(cleanNumber);
                        }
                    }
                }
            }
        } else {
            // Extract numbers from the identified column
            for (const item of data) {
                if (item[phoneColumn]) {
                    const value = String(item[phoneColumn]);
                    if (isValidPhoneNumber(value)) {
                        const cleanNumber = cleanPhoneNumber(value);
                        if (!phoneNumbers.includes(cleanNumber)) {
                            phoneNumbers.push(cleanNumber);
                        }
                    }
                }
            }
        }
    }

    function isValidPhoneNumber(value) {
        // Basic phone number validation (at least 10 digits after cleaning)
        const cleaned = value.replace(/\D/g, '');
        return cleaned.length >= 10;
    }

    function cleanPhoneNumber(value) {
        // Remove all non-digits
        let cleaned = value.replace(/\D/g, '');
        
        // Handle international format
        if (cleaned.startsWith('00')) {
            cleaned = cleaned.substring(2);
        }
        
        // Add country code if not present (assuming 91 for India)
        if (!cleaned.startsWith('91') && cleaned.length >= 10) {
            cleaned = '91' + cleaned.slice(-10);
        }
        
        return cleaned;
    }

    function removeExcelFile() {
        excelFileInput.value = '';
        fileDetails.classList.add('hidden');
        fileError.classList.add('hidden');
        phoneNumbers = [];
        excelFileUploaded = false;
        updateGenerateButtonState();
    }

    function showExcelError(message) {
        fileDetails.classList.add('hidden');
        fileError.classList.remove('hidden');
        errorMessage.textContent = message;
        excelFileUploaded = false;
        updateGenerateButtonState();
    }
    
    // Brochure File Handling
    function handleBrochureFileSelect(e) {
        const file = e.target.files[0];
        if (file) {
            handleBrochureFile(file);
        }
    }
    
    function handleBrochureFile(file) {
        // Check file type
        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/gif'];
        if (!allowedTypes.includes(file.type)) {
            alert('Only PDF and image files (JPG, PNG, GIF) are supported');
            return;
        }
        
        // Check file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
            alert('File size exceeds 10MB limit');
            return;
        }
        
        // Show upload progress
        uploadProgress.classList.remove('hidden');
        progressBar.style.width = '0%';
        uploadStatus.textContent = 'Uploading... 0%';
        
        // Create form data
        const formData = new FormData();
        formData.append('brochure', file);
        
        // Upload file
        const xhr = new XMLHttpRequest();
        
        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
                const percentComplete = Math.round((e.loaded / e.total) * 100);
                progressBar.style.width = percentComplete + '%';
                uploadStatus.textContent = `Uploading... ${percentComplete}%`;
            }
        });
        
        xhr.addEventListener('load', () => {
            if (xhr.status === 200) {
                const response = JSON.parse(xhr.responseText);
                
                if (response.success) {
                    // Update state
                    brochureFileUploaded = true;
                    brochureUrl = response.file.url;
                    
                    // Update UI
                    uploadProgress.classList.add('hidden');
                    brochureDetails.classList.remove('hidden');
                    brochureName.textContent = file.name;
                    brochureSize.textContent = formatFileSize(file.size);
                    
                    // Show preview
                    showBrochurePreview(file);
                    
                    // Update message preview
                    updateMessagePreview();
                    updateGenerateButtonState();
                } else {
                    alert('Error uploading file: ' + response.error);
                    uploadProgress.classList.add('hidden');
                }
            } else {
                alert('Upload failed. Server returned status: ' + xhr.status);
                uploadProgress.classList.add('hidden');
            }
        });
        
        xhr.addEventListener('error', () => {
            alert('Upload failed. Please check your internet connection and try again.');
            uploadProgress.classList.add('hidden');
        });
        
        xhr.open('POST', '/upload-brochure', true);
        xhr.send(formData);
    }
    
    function showBrochurePreview(file) {
        brochurePreview.classList.remove('hidden');
        previewContent.innerHTML = '';
        
        if (file.type === 'application/pdf') {
            // For PDF files
            if (file.size < 5 * 1024 * 1024) { // Only preview PDFs under 5MB
                const objectEl = document.createElement('object');
                objectEl.className = 'pdf-preview';
                objectEl.type = 'application/pdf';
                objectEl.data = URL.createObjectURL(file);
                previewContent.appendChild(objectEl);
            } else {
                // For larger PDFs, just show an icon
                const iconEl = document.createElement('div');
                iconEl.className = 'file-icon pdf-icon';
                iconEl.innerHTML = '📄';
                
                const textEl = document.createElement('p');
                textEl.className = 'text-gray-800 dark:text-gray-200 text-center';
                textEl.textContent = 'PDF file (preview not available for large files)';
                
                previewContent.appendChild(iconEl);
                previewContent.appendChild(textEl);
            }
        } else {
            // For image files
            const imgEl = document.createElement('img');
            imgEl.className = 'image-preview';
            imgEl.src = URL.createObjectURL(file);
            imgEl.alt = file.name;
            previewContent.appendChild(imgEl);
        }
    }
    
    function formatFileSize(bytes) {
        if (bytes < 1024) {
            return bytes + ' bytes';
        } else if (bytes < 1024 * 1024) {
            return (bytes / 1024).toFixed(2) + ' KB';
        } else {
            return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
        }
    }
    
    function removeBrochureFile() {
        brochureFileInput.value = '';
        brochureDetails.classList.add('hidden');
        brochurePreview.classList.add('hidden');
        brochureFileUploaded = false;
        brochureUrl = '';
        updateMessagePreview();
        updateGenerateButtonState();
    }
    
    // Message and Links
    function updateMessagePreview() {
        const msg = messageText.value.trim();
        
        if (msg) {
            let previewText = msg;
            
            // Add brochure link if available
            if (brochureFileUploaded && brochureUrl) {
                previewText += '\n\nDownload our brochure here: ' + brochureUrl;
            }
            
            messagePreview.textContent = previewText;
        } else {
            messagePreview.textContent = 'Enter your message above to see the preview';
        }
    }

    function updateGenerateButtonState() {
        generateLinksBtn.disabled = !excelFileUploaded || !messageText.value.trim();
    }

    function generateWhatsAppLinks() {
        if (!excelFileUploaded || phoneNumbers.length === 0) {
            return;
        }

        // Get message and prepare it for WhatsApp
        let message = messageText.value.trim();
        
        // Add brochure link if available
        if (brochureFileUploaded && brochureUrl) {
            message += '\n\nDownload our brochure here: ' + brochureUrl;
        }
        
        // Encode for URL
        const encodedMessage = encodeURIComponent(message);
        
        // Store all links
        whatsappLinks = [];
        
        // Clear previous results
        resultsTable.innerHTML = '';
        
        // Generate table rows for each number
        phoneNumbers.forEach(number => {
            const whatsappLink = `https://wa.me/${number}?text=${encodedMessage}`;
            whatsappLinks.push({
                number: number,
                formattedNumber: formatPhoneNumber(number),
                link: whatsappLink
            });
            
            const row = document.createElement('tr');
            row.className = 'border-b border-gray-200 dark:border-gray-700';
            
            // Number cell
            const numberCell = document.createElement('td');
            numberCell.className = 'py-3 px-4 text-gray-800 dark:text-gray-200';
            numberCell.textContent = formatPhoneNumber(number);
            
            // Message preview cell
            const messagePreviewCell = document.createElement('td');
            messagePreviewCell.className = 'py-3 px-4 text-gray-800 dark:text-gray-200';
            const messagePreviewEl = document.createElement('div');
            messagePreviewEl.className = 'message-preview';
            messagePreviewEl.textContent = message;
            messagePreviewCell.appendChild(messagePreviewEl);
            
            // Action cell
            const actionCell = document.createElement('td');
            actionCell.className = 'py-3 px-4';
            
            const sendButton = document.createElement('a');
            sendButton.href = whatsappLink;
            sendButton.target = '_blank';
            sendButton.className = 'send-button inline-flex items-center bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-md';
            sendButton.innerHTML = '✅ Send Message';
            
            actionCell.appendChild(sendButton);
            
            // Append cells to row
            row.appendChild(numberCell);
            row.appendChild(messagePreviewCell);
            row.appendChild(actionCell);
            
            // Append row to table
            resultsTable.appendChild(row);
        });
        
        // Update total count
        totalNumbers.textContent = phoneNumbers.length;
        
        // Show results section
        resultsSection.classList.remove('hidden');
    }

    function formatPhoneNumber(number) {
        // Format as +91 98765 43210
        if (number.length >= 12) {
            return `+${number.slice(0, 2)} ${number.slice(2, 7)} ${number.slice(7)}`;
        } else if (number.length >= 10) {
            return `+${number.slice(0, 2)} ${number.slice(2)}`;
        }
        return number;
    }
    
    function openAllLinks() {
        if (whatsappLinks.length === 0) return;
        
        // Due to popup blocking, we can't open all links at once
        // So we open just a few (max 5) to avoid browser blocking
        const maxLinksToOpen = Math.min(5, whatsappLinks.length);
        
        for (let i = 0; i < maxLinksToOpen; i++) {
            window.open(whatsappLinks[i].link, '_blank');
        }
        
        if (whatsappLinks.length > maxLinksToOpen) {
            alert(`Opened ${maxLinksToOpen} links. Browser popup blocking prevented opening all ${whatsappLinks.length} links at once. You can click individually on the Send Message buttons or download the CSV to access all links.`);
        }
    }

    function downloadCSV() {
        if (whatsappLinks.length === 0) return;
        
        // Create CSV content
        let csvContent = 'Phone Number,Formatted Number,WhatsApp Link\n';
        
        whatsappLinks.forEach(item => {
            csvContent += `${item.number},${item.formattedNumber},${item.link}\n`;
        });
        
        // Create a download link
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        
        link.setAttribute('href', url);
        link.setAttribute('download', 'whatsapp_links.csv');
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}); 
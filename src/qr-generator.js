const QRCode = require('qrcode');

class QRCodeGenerator {
    static async generateWifiQrCode(ssid, password, url, size = 10) {
        try {
            // WiFi QR code format: WIFI:T:WPA;S:network_name;P:password;H:false;;
            const wifiData = `WIFI:T:WPA;S:${ssid};P:${password};H:false;;`;
            
            const qrCodeDataUrl = await QRCode.toDataURL(wifiData, {
                errorCorrectionLevel: 'L',
                type: 'image/png',
                quality: 0.92,
                margin: 4,
                color: {
                    dark: '#000000',
                    light: '#FFFFFF'
                },
                width: size * 20 // Convert size to pixels
            });
            
            // Return just the base64 data without the data:image/png;base64, prefix
            return qrCodeDataUrl.split(',')[1];
        } catch (error) {
            console.error('Error generating WiFi QR code:', error);
            throw error;
        }
    }
    
    static async generateQrCode(data, size = 10) {
        try {
            const qrCodeDataUrl = await QRCode.toDataURL(data, {
                errorCorrectionLevel: 'L',
                type: 'image/png',
                quality: 0.92,
                margin: 4,
                color: {
                    dark: '#000000',
                    light: '#FFFFFF'
                },
                width: size * 20 // Convert size to pixels
            });
            
            // Return just the base64 data without the data:image/png;base64, prefix
            return qrCodeDataUrl.split(',')[1];
        } catch (error) {
            console.error('Error generating QR code:', error);
            throw error;
        }
    }
    
    static async generateQrCodeBuffer(data, options = {}) {
        try {
            const defaultOptions = {
                errorCorrectionLevel: 'L',
                type: 'png',
                quality: 0.92,
                margin: 4,
                color: {
                    dark: '#000000',
                    light: '#FFFFFF'
                },
                width: 200
            };
            
            const mergedOptions = { ...defaultOptions, ...options };
            const buffer = await QRCode.toBuffer(data, mergedOptions);
            
            return buffer;
        } catch (error) {
            console.error('Error generating QR code buffer:', error);
            throw error;
        }
    }
    
    static async generateQrCodeSvg(data, options = {}) {
        try {
            const defaultOptions = {
                errorCorrectionLevel: 'L',
                type: 'svg',
                quality: 0.92,
                margin: 4,
                color: {
                    dark: '#000000',
                    light: '#FFFFFF'
                },
                width: 200
            };
            
            const mergedOptions = { ...defaultOptions, ...options };
            const svg = await QRCode.toString(data, mergedOptions);
            
            return svg;
        } catch (error) {
            console.error('Error generating QR code SVG:', error);
            throw error;
        }
    }
}

module.exports = QRCodeGenerator; 
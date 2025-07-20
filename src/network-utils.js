const { exec } = require('child_process');
const { promisify } = require('util');
const os = require('os');
const fs = require('fs').promises;

const execAsync = promisify(exec);

class NetworkUtils {
    static async getDeviceHotspotSettings() {
        const platform = os.platform();
        
        let hotspotSsid = null;
        let hotspotPassword = null;
        let source = null;
        
        try {
            if (platform === 'linux') {
                return await this.getLinuxHotspotSettings();
            } else if (platform === 'darwin') {
                return await this.getMacOSHotspotSettings();
            } else if (platform === 'win32') {
                return await this.getWindowsHotspotSettings();
            }
        } catch (error) {
            console.error('Error detecting hotspot settings:', error);
        }
        
        // Ultimate fallback
        try {
            const hostname = os.hostname();
            return [hostname, 'gamehub123', 'hostname fallback'];
        } catch (error) {
            return ['GameHub-Direct', 'gamehub123', 'default'];
        }
    }
    
    static async getLinuxHotspotSettings() {
        let hotspotSsid = null;
        let hotspotPassword = null;
        let source = null;
        
        // Check if it's Raspberry Pi
        try {
            const cpuinfo = await fs.readFile('/proc/cpuinfo', 'utf8');
            if (cpuinfo.toLowerCase().includes('raspberry pi') || cpuinfo.toLowerCase().includes('bcm2')) {
                // Raspberry Pi - check hostapd config
                try {
                    const hostapdConfig = await fs.readFile('/etc/hostapd/hostapd.conf', 'utf8');
                    const lines = hostapdConfig.split('\n');
                    
                    for (const line of lines) {
                        if (line.startsWith('ssid=')) {
                            hotspotSsid = line.split('=')[1].trim();
                        } else if (line.startsWith('wpa_passphrase=')) {
                            hotspotPassword = line.split('=')[1].trim();
                        }
                    }
                    
                    if (hotspotSsid && hotspotPassword) {
                        source = 'hostapd config';
                        return [hotspotSsid, hotspotPassword, source];
                    }
                } catch (error) {
                    // hostapd config not accessible
                }
            }
        } catch (error) {
            // Not a Raspberry Pi or can't read cpuinfo
        }
        
        // Check NetworkManager for Linux
        try {
            const { stdout } = await execAsync('nmcli -t -f NAME,TYPE con show', { timeout: 5000 });
            const connections = stdout.split('\n');
            
            for (const connection of connections) {
                if (connection.includes('802-11-wireless')) {
                    const connectionName = connection.split(':')[0];
                    
                    try {
                        // Get SSID
                        const ssidResult = await execAsync(`nmcli -t -f 802-11-wireless.ssid con show "${connectionName}"`, { timeout: 5000 });
                        hotspotSsid = ssidResult.stdout.trim().split(':').pop();
                        
                        // Get password
                        const pwdResult = await execAsync(`nmcli -s -t -f 802-11-wireless-security.psk con show "${connectionName}"`, { timeout: 5000 });
                        hotspotPassword = pwdResult.stdout.trim().split(':').pop();
                        
                        if (hotspotSsid && hotspotPassword) {
                            source = 'NetworkManager';
                            return [hotspotSsid, hotspotPassword, source];
                        }
                    } catch (error) {
                        continue;
                    }
                }
            }
        } catch (error) {
            // NetworkManager not available
        }
        
        // Fallback to hostname
        try {
            const { stdout } = await execAsync('hostname', { timeout: 5000 });
            hotspotSsid = stdout.trim();
            hotspotPassword = 'raspberry'; // Common default
            source = 'hostname + default';
            return [hotspotSsid, hotspotPassword, source];
        } catch (error) {
            // Can't get hostname
        }
        
        return [null, null, null];
    }
    
    static async getMacOSHotspotSettings() {
        let hotspotSsid = null;
        let hotspotPassword = null;
        let source = null;
        
        // Get computer name
        try {
            const { stdout } = await execAsync('scutil --get ComputerName', { timeout: 5000 });
            hotspotSsid = stdout.trim();
            
            // Try to get Internet Sharing password from keychain
            const keychainQueries = [
                'security find-generic-password -w -s "AirPort network password"',
                'security find-generic-password -w -s "Internet Sharing"',
                'security find-generic-password -w -a "AirPort"',
                `security find-internet-password -w -s "${hotspotSsid}"`
            ];
            
            for (const query of keychainQueries) {
                try {
                    const { stdout } = await execAsync(query, { timeout: 5000 });
                    const password = stdout.trim();
                    if (password && password.length >= 8) {
                        hotspotPassword = password;
                        source = 'macOS keychain';
                        return [hotspotSsid, hotspotPassword, source];
                    }
                } catch (error) {
                    continue;
                }
            }
            
            // Try to read from system configuration
            const plistPaths = [
                '/Library/Preferences/SystemConfiguration/com.apple.nat.plist',
                '/Library/Preferences/SystemConfiguration/preferences.plist'
            ];
            
            for (const plistPath of plistPaths) {
                try {
                    const { stdout } = await execAsync(`plutil -extract SharingNetworkPassword raw "${plistPath}"`, { timeout: 5000 });
                    const password = stdout.trim();
                    if (password) {
                        hotspotPassword = password;
                        source = 'macOS system preferences';
                        return [hotspotSsid, hotspotPassword, source];
                    }
                } catch (error) {
                    continue;
                }
            }
            
            // If we found SSID but no password, return with null password
            if (hotspotSsid) {
                source = 'device name (password needed)';
                return [hotspotSsid, null, source];
            }
        } catch (error) {
            // Can't get computer name
        }
        
        return [null, null, null];
    }
    
    static async getWindowsHotspotSettings() {
        let hotspotSsid = null;
        let hotspotPassword = null;
        let source = null;
        
        // Get computer name
        try {
            const { stdout } = await execAsync('hostname', { timeout: 5000 });
            hotspotSsid = stdout.trim();
            
            // Try to get Mobile Hotspot password from various profiles
            const profileNames = [
                'Local Area Connection* 12',
                'Local Area Connection* 2',
                'Local Area Connection* 3',
                'Microsoft Wi-Fi Direct Virtual Adapter',
                hotspotSsid
            ];
            
            for (const profileName of profileNames) {
                try {
                    const { stdout } = await execAsync(`netsh.exe wlan show profile name="${profileName}" key=clear`, { timeout: 5000 });
                    const lines = stdout.split('\n');
                    
                    for (const line of lines) {
                        if (line.includes('Key Content') || line.includes('Network key')) {
                            const password = line.split(':').pop().trim();
                            if (password && password.length >= 8) {
                                hotspotPassword = password;
                                source = 'Windows Mobile Hotspot profile';
                                return [hotspotSsid, hotspotPassword, source];
                            }
                        }
                    }
                } catch (error) {
                    continue;
                }
            }
            
            // If we found SSID but no password, return with null password
            if (hotspotSsid) {
                source = 'computer name (password needed)';
                return [hotspotSsid, null, source];
            }
        } catch (error) {
            // Can't get computer name
        }
        
        return [null, null, null];
    }
    
    static async getLocalIp() {
        const platform = os.platform();
        const machine = os.arch();
        
        // Check if it's Raspberry Pi
        let isRaspberryPi = false;
        if (platform === 'linux') {
            try {
                const cpuinfo = await fs.readFile('/proc/cpuinfo', 'utf8');
                if (cpuinfo.toLowerCase().includes('raspberry pi') || cpuinfo.toLowerCase().includes('bcm2')) {
                    isRaspberryPi = true;
                }
            } catch (error) {
                // Not a Raspberry Pi
            }
        }
        
        // Method 1: OS-specific IP detection
        try {
            const foundIps = [];
            
            if (platform === 'linux') {
                try {
                    const { stdout } = await execAsync('ip addr show', { timeout: 3000 });
                    const lines = stdout.split('\n');
                    
                    for (const line of lines) {
                        if (line.includes('inet ')) {
                            const match = line.match(/inet\s+(\d+\.\d+\.\d+\.\d+)/);
                            if (match) {
                                const ip = match[1];
                                if (!ip.startsWith('127.') && !ip.startsWith('169.254.')) {
                                    foundIps.push(ip);
                                }
                            }
                        }
                    }
                } catch (error) {
                    // ip command failed
                }
            } else if (platform === 'darwin') {
                try {
                    const { stdout } = await execAsync('ifconfig', { timeout: 3000 });
                    const lines = stdout.split('\n');
                    
                    for (const line of lines) {
                        if (line.includes('inet ')) {
                            const match = line.match(/inet\s+(\d+\.\d+\.\d+\.\d+)/);
                            if (match) {
                                const ip = match[1];
                                if (!ip.startsWith('127.') && !ip.startsWith('169.254.')) {
                                    foundIps.push(ip);
                                }
                            }
                        }
                    }
                } catch (error) {
                    // ifconfig failed
                }
            } else if (platform === 'win32') {
                try {
                    const { stdout } = await execAsync('ipconfig', { timeout: 3000 });
                    const lines = stdout.split('\n');
                    
                    for (const line of lines) {
                        if (line.includes('IPv4')) {
                            const match = line.match(/(\d+\.\d+\.\d+\.\d+)/);
                            if (match) {
                                const ip = match[1];
                                if (!ip.startsWith('127.') && !ip.startsWith('169.254.')) {
                                    foundIps.push(ip);
                                }
                            }
                        }
                    }
                } catch (error) {
                    // ipconfig failed
                }
            }
            
            // Prioritize IPs based on OS and setup
            if (foundIps.length > 0) {
                let hotspotPrefixes;
                
                if (isRaspberryPi) {
                    hotspotPrefixes = ['192.168.4.', '192.168.2.', '192.168.42.', '10.0.'];
                } else if (platform === 'darwin') {
                    hotspotPrefixes = ['192.168.2.', '192.168.42.', '10.0.', '192.168.4.'];
                } else if (platform === 'win32') {
                    hotspotPrefixes = ['192.168.137.', '192.168.2.', '192.168.4.', '10.0.'];
                } else {
                    hotspotPrefixes = ['192.168.4.', '192.168.2.', '192.168.42.', '10.0.'];
                }
                
                // First try to find hotspot IPs
                for (const ip of foundIps) {
                    for (const prefix of hotspotPrefixes) {
                        if (ip.startsWith(prefix)) {
                            return ip;
                        }
                    }
                }
                
                // If no hotspot IP, return first available IP
                return foundIps[0];
            }
        } catch (error) {
            console.error('OS-specific IP detection failed:', error);
        }
        
        // Method 2: Use Node.js os.networkInterfaces()
        try {
            const interfaces = os.networkInterfaces();
            const foundIps = [];
            
            for (const interfaceName in interfaces) {
                const addresses = interfaces[interfaceName];
                for (const address of addresses) {
                    if (address.family === 'IPv4' && !address.internal) {
                        if (!address.address.startsWith('127.') && !address.address.startsWith('169.254.')) {
                            foundIps.push(address.address);
                        }
                    }
                }
            }
            
            if (foundIps.length > 0) {
                return foundIps[0];
            }
        } catch (error) {
            console.error('Node.js network interfaces detection failed:', error);
        }
        
        // OS-specific default fallback
        if (isRaspberryPi) {
            return '192.168.4.1'; // Raspberry Pi hotspot default
        } else if (platform === 'darwin') {
            return '192.168.2.1'; // macOS Internet Sharing default
        } else if (platform === 'win32') {
            return '192.168.137.1'; // Windows Mobile Hotspot default
        } else {
            return '192.168.4.1'; // Generic Linux default
        }
    }
}

module.exports = NetworkUtils; 
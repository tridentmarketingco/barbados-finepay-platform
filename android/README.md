# PayFine Warden - Sunmi POS Android App

Android application for PayFine Warden Portal with integrated Sunmi thermal printer support.

## Quick Start

### 1. Open in Android Studio

```bash
# Open the android/ directory in Android Studio
# File → Open → Select android/ folder
```

### 2. Update Web App URL

Edit `app/src/main/java/com/payfine/warden/MainActivity.kt`:

```kotlin
// Line ~30
private const val WEB_APP_URL = "http://YOUR_SERVER_IP:3000"
```

### 3. Build & Run

```bash
# Connect Sunmi device via USB
# Click Run button in Android Studio
# OR use command line:
./gradlew installDebug
```

## Features

✅ **WebView Wrapper** - Loads existing React web app  
✅ **Sunmi AIDL Integration** - Official printer service  
✅ **JavaScript Bridge** - Exposes printer to web app  
✅ **QR Code Printing** - Payment QR codes  
✅ **Barcode Printing** - Ticket serial numbers  
✅ **Auto-Print** - Prints after ticket creation  
✅ **58mm & 80mm Paper** - Auto-detects paper width  

## Architecture

```
React Web App (JavaScript)
         ↓
JavaScript Bridge (window.SunmiPrinter)
         ↓
MainActivity.kt (WebView + Bridge)
         ↓
PrinterHelper.kt (AIDL Service Manager)
         ↓
IWoyouService (Sunmi Printer Service)
         ↓
Thermal Printer Hardware
```

## Project Structure

```
app/src/main/
├── java/com/payfine/warden/
│   ├── MainActivity.kt          # WebView + JS bridge
│   ├── PrinterHelper.kt         # Printer manager
│   └── models/
│       └── OffenceTicket.kt     # Ticket data class
├── aidl/woyou/aidlservice/jiuiv5/
│   ├── IWoyouService.aidl       # Sunmi printer interface
│   └── ICallback.aidl           # Callback interface
├── res/
│   └── values/
│       ├── strings.xml
│       ├── colors.xml
│       └── themes.xml
└── AndroidManifest.xml
```

## JavaScript Bridge API

The web app can call these functions:

```javascript
// Print ticket
window.SunmiPrinter.printTicket(JSON.stringify({
  serialNumber: "A123456",
  offenceDesc: "Speeding",
  amount: 150.00,
  // ... other fields
}));

// Get printer status
const status = window.SunmiPrinter.getPrinterStatus();
// Returns: {"status": 1, "statusText": "Ready", "isReady": true}

// Test print
window.SunmiPrinter.testPrint();

// Check if ready
const ready = window.SunmiPrinter.isPrinterReady();
```

## Building APK

### Debug Build

```bash
./gradlew assembleDebug
# Output: app/build/outputs/apk/debug/app-debug.apk
```

### Release Build

1. Create keystore:
```bash
keytool -genkey -v -keystore payfine-warden.keystore \
  -alias payfine-warden -keyalg RSA -keysize 2048 -validity 10000
```

2. Create `keystore.properties`:
```properties
storePassword=YOUR_PASSWORD
keyPassword=YOUR_PASSWORD
keyAlias=payfine-warden
storeFile=../payfine-warden.keystore
```

3. Build:
```bash
./gradlew assembleRelease
# Output: app/build/outputs/apk/release/app-release.apk
```

## Deployment

### USB Installation

```bash
# Enable USB debugging on Sunmi device
# Connect via USB
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

### File Transfer

1. Copy APK to device storage
2. Open File Manager on device
3. Tap APK file
4. Tap "Install"

## Testing

### Test Printer

1. Open app on Sunmi device
2. Check printer status indicator
3. Create test ticket
4. Verify print output
5. Scan QR code with phone

### Debug WebView

1. Enable debugging in `MainActivity.kt`:
```kotlin
WebView.setWebContentsDebuggingEnabled(true)
```

2. Open Chrome on desktop
3. Navigate to `chrome://inspect`
4. Select device and inspect WebView

## Troubleshooting

### Printer Not Detected

- Restart app
- Restart Sunmi device
- Verify genuine Sunmi device with built-in printer

### WebView Not Loading

- Check `WEB_APP_URL` is correct
- Verify network connectivity
- Check server is running
- Check firewall allows device IP

### Print Quality Issues

- Use thermal paper (not regular paper)
- Clean print head
- Check paper is properly loaded
- Increase QR code size if not scanning

## Documentation

📖 **Full Setup Guide:** `docs/SUNMI_ANDROID_SETUP.md`

## Requirements

- Android Studio Hedgehog (2023.1.1) or later
- JDK 17 or later
- Android SDK API 21+ (target API 34)
- Sunmi POS device with built-in thermal printer

## Compatible Devices

✅ Sunmi V2, V2 Pro  
✅ Sunmi T2, T2 Lite, T2 Mini  
✅ Sunmi P2, P2 Pro, P2 Lite  
✅ Other Sunmi devices with built-in thermal printers  

## License

Proprietary - PayFine Platform

## Support

- **Documentation:** `docs/SUNMI_ANDROID_SETUP.md`
- **Email:** support@payfine.example.com
- **Issues:** [GitHub Issues]

---

**Version:** 1.0.0  
**Last Updated:** January 29, 2024

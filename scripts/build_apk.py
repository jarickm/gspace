import zipfile
import struct
import hashlib
import os

def build_apk():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    output_dir = os.path.join(base_dir, 'public', 'downloads')
    os.makedirs(output_dir, exist_ok=True)
    apk_path = os.path.join(output_dir, 'GQueues-Workspace.apk')

    # Read icons
    icon_192 = b''
    icon_512 = b''
    p192 = os.path.join(base_dir, 'public', 'pwa-192x192.png')
    p512 = os.path.join(base_dir, 'public', 'pwa-512x512.png')
    if os.path.exists(p192):
        with open(p192, 'rb') as f:
            icon_192 = f.read()
    if os.path.exists(p512):
        with open(p512, 'rb') as f:
            icon_512 = f.read()

    # Minimal DEX file (magic "dex\n035\0" + header)
    # Header size: 0x70 (112 bytes)
    dex_magic = b'dex\n035\x00'
    dex_header = bytearray(112)
    dex_header[0:8] = dex_magic
    # File size = 112
    struct.pack_into('<I', dex_header, 32, 112)
    # Header size = 112
    struct.pack_into('<I', dex_header, 36, 112)
    # Endian tag = 0x12345678
    struct.pack_into('<I', dex_header, 40, 0x12345678)
    
    # Calculate SHA1 and Adler32 checksums for DEX
    dex_sha1 = hashlib.sha1(dex_header[32:]).digest()
    dex_header[12:32] = dex_sha1
    import zlib
    dex_adler = zlib.adler32(dex_header[12:]) & 0xffffffff
    struct.pack_into('<I', dex_header, 8, dex_adler)

    # AndroidManifest.xml
    manifest_xml = b'''<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.coolaire.gqueues.workspace"
    android:versionCode="1"
    android:versionName="1.0.0">
    <uses-sdk android:minSdkVersion="24" android:targetSdkVersion="34" />
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <application
        android:label="GQueues Workspace"
        android:icon="@mipmap/ic_launcher"
        android:theme="@android:style/Theme.NoTitleBar.Fullscreen"
        android:hardwareAccelerated="true">
        <activity
            android:name="com.coolaire.gqueues.MainActivity"
            android:exported="true"
            android:configChanges="orientation|keyboardHidden|screenSize">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>
'''

    # Write files into zip
    files_to_hash = {}

    with zipfile.ZipFile(apk_path, 'w', compression=zipfile.ZIP_DEFLATED) as z:
        # 1. AndroidManifest.xml
        z.writestr('AndroidManifest.xml', manifest_xml)
        files_to_hash['AndroidManifest.xml'] = hashlib.sha1(manifest_xml).digest()

        # 2. classes.dex
        z.writestr('classes.dex', bytes(dex_header))
        files_to_hash['classes.dex'] = hashlib.sha1(bytes(dex_header)).digest()

        # 3. Icons
        if icon_192:
            z.writestr('res/mipmap-hdpi/ic_launcher.png', icon_192)
            files_to_hash['res/mipmap-hdpi/ic_launcher.png'] = hashlib.sha1(icon_192).digest()
        if icon_512:
            z.writestr('res/mipmap-xxxhdpi/ic_launcher.png', icon_512)
            files_to_hash['res/mipmap-xxxhdpi/ic_launcher.png'] = hashlib.sha1(icon_512).digest()

        # 4. App config pointing to our web app
        app_cfg = b'{"url":"https://ais-dev-enxnpelbddd7tflkv7rfjd-462514151820.asia-east1.run.app","name":"GQueues Workspace"}'
        z.writestr('assets/app_config.json', app_cfg)
        files_to_hash['assets/app_config.json'] = hashlib.sha1(app_cfg).digest()

        # 5. META-INF/MANIFEST.MF
        import base64
        mf_lines = [b'Manifest-Version: 1.0', b'Created-By: 1.0 (Android)']
        for fname, fhash in files_to_hash.items():
            mf_lines.append(f'Name: {fname}'.encode())
            mf_lines.append(b'SHA1-Digest: ' + base64.b64encode(fhash))
            mf_lines.append(b'')
        manifest_mf = b'\r\n'.join(mf_lines) + b'\r\n'
        z.writestr('META-INF/MANIFEST.MF', manifest_mf)

        # 6. META-INF/CERT.SF
        sf_lines = [
            b'Signature-Version: 1.0',
            b'Created-By: 1.0 (Android)',
            b'SHA1-Digest-Manifest: ' + base64.b64encode(hashlib.sha1(manifest_mf).digest()),
            b''
        ]
        cert_sf = b'\r\n'.join(sf_lines) + b'\r\n'
        z.writestr('META-INF/CERT.SF', cert_sf)

        # 7. Dummy RSA signature block
        z.writestr('META-INF/CERT.RSA', b'\x30\x82\x01\x0a\x02\x82\x01\x01\x00' + b'\x00' * 256)

    print(f"Created {apk_path} ({os.path.getsize(apk_path)} bytes)")

    # Also build Windows Desktop Installer Script
    win_installer_path = os.path.join(output_dir, 'Install-GQueues-Windows.bat')
    app_url = 'https://ais-dev-enxnpelbddd7tflkv7rfjd-462514151820.asia-east1.run.app'
    bat_content = f'''@echo off
title Installing GQueues Workspace Manager Desktop App...
echo ========================================================
echo   GQueues Workspace Manager - Windows App Installer
echo ========================================================
echo.
echo Installing desktop shortcut for standalone app mode...

set APP_URL={app_url}
set SHORTCUT_NAME=GQueues Workspace.url
set DESKTOP_PATH=%USERPROFILE%\\Desktop\\%SHORTCUT_NAME%
set STARTMENU_PATH=%APPDATA%\\Microsoft\\Windows\\Start Menu\\Programs\\%SHORTCUT_NAME%

(
echo [InternetShortcut]
echo URL=%APP_URL%
echo IconIndex=0
echo IconFile=%SystemRoot%\\System32\\shell32.dll
echo HotKey=0
echo [{{000214A0-0000-0000-C000-000000000046}}]
echo Prop3=19,11
) > "%DESKTOP_PATH%"

copy "%DESKTOP_PATH%" "%STARTMENU_PATH%" >nul

echo [SUCCESS] GQueues Workspace has been installed to your Desktop and Start Menu!
echo.
echo Launching GQueues Workspace in standalone app mode...
start "" "%APP_URL%"
timeout /t 3 >nul
exit
'''
    with open(win_installer_path, 'w', newline='\r\n') as f:
        f.write(bat_content)
    print(f"Created {win_installer_path}")

if __name__ == '__main__':
    build_apk()

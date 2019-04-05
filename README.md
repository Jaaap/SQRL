# SQRL

## Secure Quick Reliable Login by Steve Gibson over at https://grc.com/sqrl
This is a WebExtension for Chrome and Firefox that enables logging into SQRL-enabled webservers.

## How to use?
While in development, you can clone or download this WebExtension, then ...

For **Chrome** go to chrome://extensions/, enable "Developer mode" and then "Load unpacked extension...". Point it to the root of the SQRL folder/dir you just created.

For **Firefox**, first create an xpi file with a command like `cd SQRL; zip -r SQRL.xpi *` then open FireFox Developer Edition (normal Firefox will not work), go to about:config, search for xpinstall.signatures.required and set it to false, then go to about:addons, Click on the gear icon (⚙) pulldown, click "Install Addon From File..." and open the SQRL.xpi file.

## TODO's
- [x] Better error messages on Rescue Code input
- [ ] Remove blocking of cross-origin authentications
- [ ] Add user confirmation of cross-origin authentications, show domain
- [ ] Change password functionality
- [ ] Move identity import to separate tab, not in popup
- [ ] Add identity import by QR code


## Feature requests
- Scan QR codes via webcam
- Keep a list of sites where SQRL was used
	- Click a link to open the site and log in to it
	- Panic button which locks all known sites

# SQRL

## Secure Quick Reliable Login by Steve Gibson over at https://grc.com/sqrl
This is a WebExtension for Chrome and Firefox that enables logging into SQRL-enabled webservers.

## How to use?
While in development, you can clone or download this WebExtension, then ...

For **Chrome** go to chrome://extensions/, enable "Developer mode" and then "Load unpacked extension...". Point it to the root of the SQRL folder/dir you just created.

For **Firefox**, first create an xpi file with a command like `cd SQRL; zip -r SQRL.xpi *` then open FireFox Developer Edition (normal Firefox will not work), go to about:config, search for xpinstall.signatures.required and set it to false, then go to about:addons, Click on the gear icon (⚙) pulldown, click "Install Addon From File..." and open the SQRL.xpi file.

## TODO's
- [x] Better error messages on Rescue Code input
- [x] Remove blocking of cross-origin authentications
- [x] Add user confirmation of cross-origin authentications, show domain
- [ ] Change password functionality
- [x] Move identity import to separate tab, not in popup
- [x] Add identity import by QR code via webcam
- [ ] Font-family on Firefox/Ubuntu is wrong

## Feature requests
- Keep a list of sites where SQRL was used
	- Click a link to open the site and log in to it
	- Panic button which locks all known sites

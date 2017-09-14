# SQRL

## Secure Quick Reliable Login by Steve Gibson over at https://grc.com/sqrl
This is a WebExtension for Chrome and Firefox that enables logging into SQRL-enabled webservers.

## How to use?
While in development, you can clone or download this WebExtension, then ...

For **Chrome** go to chrome://extensions/, enable "Developer mode" and then "Load unpacked extension...". Point it to the root of the SQRL folder/dir you just created.

For **Firefox**, go to about:addons, Click on the gear icon (⚙) pulldown, click "Install Addon From File..." and open the SQRL.xpi file. If the SQRL.xpi file does not exist it can be created with the command `zip -r SQRL.xpi *` in the root of the SQRL folder/dir. This requires the xpinstall.signatures.required setting in about:config to be set to false.

# SQRL

## Secure Quick Reliable Login by Steve Gibson over at https://grc.com/sqrl
This is a WebExtension for Chrome and Firefox that enables logging into SQRL-enabled webservers.

## How to use?
### Firefox
Install latest release from: https://addons.mozilla.org/en-US/firefox/addon/sqrl/

**OR** clone or download this WebExtension, then create an xpi file with a command like `cd SQRL; zip -r SQRL.xpi *` then open FireFox Developer Edition (normal Firefox will not work), go to about:config, search for xpinstall.signatures.required and set it to false, then go to about:addons, Click on the gear icon (⚙) pulldown, click "Install Addon From File..." and open the SQRL.xpi file.

### Chrome
Install latest release from: https://chrome.google.com/webstore/detail/sqrl/adfaiodpchglcmalaiifkcclimpffono

**OR** clone or download this WebExtension, then go to chrome://extensions/, enable "Developer mode" and then "Load unpacked extension...". Point it to the root of the SQRL folder/dir you just created.

## TODO's
- [x] Better error messages on Rescue Code input
- [x] Remove blocking of cross-origin authentications
- [x] Add user confirmation of cross-origin authentications, show domain
- [x] Move identity import to separate tab, not in popup
- [x] Add identity import by QR code via webcam
- [x] Font-family on Firefox/Ubuntu is wrong
- [ ] Make non-empty password mandatory
- [x] Firefox white empty popup: https://bugzilla.mozilla.org/show_bug.cgi?id=1416505
- [ ] Explain import needs Rescue Code, cannot import with Password
- [x] Explain Settings > Password > Remember
- [x] Automatic formatting for textual identity input
- [x] Automatic formatting (add and remove whitespace) for textual identity input

## Feature requests
- Change name of identity
- Keep a list of sites where SQRL was used
	- Click a link to open the site and log in to it
	- Panic button which locks all known sites

## SQRL feature status
- [ ] cmd
  - [x] query
  - [x] ident
  - [ ] disable
  - [ ] enable (URS/SUK)
  - [ ] remove (URS/SUK)
- [ ] opt
  - [x] Client-Provided Sessions (CPS)
  - [ ] sqrlonly
  - [ ] hardlock
  - [ ] suk
- [x] tif
  - [x] ID_MATCH (1)
  - [x] PREV_ID_MATCH (2)
  - [x] IP_MATCH (4)
  - [x] SQRL_DISABLED (8)
  - [x] UNSUPPORTED_FUNCTION (16)
  - [x] TRANSIENT_ERROR (32)
  - [x] COMMAND_FAILED (64)
  - [x] CLIENT_FAILURE (128)
  - [x] BAD_ID (256)
  - [x] ID_SUPERCEDED (512)
- [ ] QuickPass
- [ ] ver ≠ 1
- [ ] ask / btn
- [ ] can (Cancellation URL)
- [x] x (Path extension)
- [x] Optional additional name=value pair data
- [ ] Alternate IDK
- [ ] Rekeyed identities
  - [ ] Rekey an existing identity
  - [x] Work with rekeyed identities in server communication (max 3 PIUKs)
- [ ] Client secrets (SIN/INS/PINS)
- [ ] Change password with old password
- [ ] Change password with Rescue Code
- [x] Show domain name on cross-origin authentications
- [ ] Export Identity
  - [x] Text
  - [x] QR Code (with Rescue Code)
  - [ ] QR Code (with Password)
  - [ ] File
    - [ ] .sqrl
    - [ ] .sqrc
- [x] Import Identity
  - [x] Text
  - [x] QR Code (with Rescue Code)
  - [ ] QR Code (with Password)
  - [x] File
    - [x] .sqrl
    - [x] .sqrc

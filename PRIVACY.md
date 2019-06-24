# SQRL WebExtension Privacy Policy

## Data collection
The SQRL WebExtension does not collect any data.
(But Chrome does collect **a lot** of data, Firefox a little and GitHub a little).

## Data storage
The SQRL WebExtension stores your "Textual Identity" and the "Encrypted IMK", "Encrypted ILK", "Password Initialisation Vector", "Password Salt" and settings (like "Save password") on disk (localStorage) and in memory.
Anything you enter in the WebExtension is also stored in memory (like the Password and the Rescue Code).

## Inspection and alteration of web pages in Chrome and Firefox
The SQRL WebExtension inspects HTML pages you visit to look for anchors (links) with the SQRL protocol (like sqrl://server.com/sub).
The page is scanned once after page load and also every change to the DOM is checked to see if any new links were added (using MutationObserver).
The page is modified when such links are encountered: events are added and arrows are drawn on the page.

## Requests for external resources
Requests are made to the targets (or hrefs) in the anchors mentioned above. These may be on a different domain (or origin) from the page you are visiting.

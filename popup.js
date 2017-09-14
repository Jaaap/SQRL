{
"use strict";

function init()
{
/*
	if ("chrome" in window)
	{
		chrome.tabs.sendMessage(currentTab.id, {'type': 'hasLoginForm', 'baseDomain': baseDomain}, data => {
			if (typeof data !== 'undefined')
			{
				chrome.browserAction.setBadgeText({"text": (1+i) + "/" + vaultMatches.length, "tabId": currentTab.id});
				chrome.tabs.sendMessage(currentTab.id, {'type': 'fillLoginForm', 'baseDomain': baseDomain, 'user': row[USERNAME], 'pass': row[PASSWORD], 'submit': vaultMatches.length == 1}, response => { window.close(); });
				}
			}
		});
		chrome.runtime.sendMessage({'action': 'blacklist.get'}, blacklist => { if (blacklist != null) { $('textarea[name="blacklist"]').value = blacklist.join("\n"); } });
	}
	$('div.export button').addEventListener("click", onExportButtonClick, false);
*/
}

document.addEventListener("DOMContentLoaded", init);

}

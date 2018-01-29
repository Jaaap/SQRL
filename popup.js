{
"use strict";

function onCreateFormSubmit(evt)
{
	evt.preventDefault();
	console.log(this, evt);
}
function onImportFormSubmit(evt)
{
	evt.preventDefault();
	console.log(this, evt);
	let elems = this.elements;
	chrome.runtime.sendMessage({'action': 'importIdentity', "textualIdentity": elems.identity.value, "rescueCode": elems.rescuecode.value }, result => {
		console.log("onImportFormSubmit", result);
		elems[elems.length - 1].className = result.success ? "success" : "failure";
		if (result.success)
		{
			elems.identity.value = "";
			elems.rescuecode.value = "";
		}
	});
}
function onChangepasswordFormSubmit(evt)
{
	evt.preventDefault();
	console.log(this, evt);
}
function onDeletepasswordFormSubmit(evt)
{
	evt.preventDefault();
	console.log(this, evt);
}
function onEraseidentityFormSubmit(evt)
{
	evt.preventDefault();
	console.log(this, evt);
}
function onSettingsFormSubmit(evt)
{
	evt.preventDefault();
	console.log(this, evt);
}
function init()
{
	// [ form#create, form#import, form#changepassword, form#deletepassword, form#eraseidentity, form#settings ]
	$('form#create').submit(onCreateFormSubmit);
	$('form#import').submit(onImportFormSubmit);
	$('form#changepassword').submit(onChangepasswordFormSubmit);
	$('form#deletepassword').submit(onDeletepasswordFormSubmit);
	$('form#eraseidentity').submit(onEraseidentityFormSubmit);
	$('form#settings').submit(onSettingsFormSubmit);
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

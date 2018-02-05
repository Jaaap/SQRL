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
			$('form#import label+b').text("").attr("title", "");
			$('#identityhash').text(result.name);
			setTabsEnabling(true);
		}
	});
}
function onSetpasswordFormSubmit(evt)
{
	evt.preventDefault();
	console.log(this, evt);
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
	chrome.runtime.sendMessage({'action': 'eraseIdentity' }, error => {
		let btn = $('form#eraseidentity button')[0];
		btn.className = error ? "failure" : "success";
		btn.title = error || "";
		setTabsEnabling(false);
	});
}

function onTextualIdentityKeyUp(evt)
{
	let ta = evt.target;
	let validationData = validateTextualIdentity(ta.value);
	$('form#import label+b').text(new Array(validationData.lineNr + 1).join('✅ ') + (validationData.success ? '' : '❌')).attr("title", validationData.message||"");
	$('form#import textarea[name="identity"]')[0].setCustomValidity(validationData.message||"");
}
function setTabsEnabling(hasIdentity)
{
	let hasPassword = false;//FIXME
	$('#tab3,#tab6').enable(hasIdentity);
	$('#tab4').enable(hasIdentity && !hasPassword);
	$('#tab5').enable(hasPassword);
	$('#tab1,#tab2').enable(!hasIdentity);
}
function init()
{
	// [ form#create, form#import, form#changepassword, form#deletepassword, form#eraseidentity, form#settings ]
	$('form#create').submit(onCreateFormSubmit);
	$('form#import').submit(onImportFormSubmit);
	$('form#setpassword').submit(onSetpasswordFormSubmit);
	$('form#changepassword').submit(onChangepasswordFormSubmit);
	$('form#deletepassword').submit(onDeletepasswordFormSubmit);
	$('form#eraseidentity').submit(onEraseidentityFormSubmit);
	$('form#import textarea[name="identity"]').keyup(onTextualIdentityKeyUp);
	if ("chrome" in window)
	{
		chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
			if (request.action == "enscryptUpdate")
			{
				$('form#import progress').val(request.step).attr("max", request.max);
			}
		});
		chrome.runtime.sendMessage({'action': 'hasIdentity' }, result => {
			setTabsEnabling(result.hasIdentity);
			if (result.hasIdentity)
				$('#identityhash').text(result.name);
			if (result.textualIdentity)
				$('form#export textarea[name="identity"]').val(result.textualIdentity);
		});
		$('#version').text(chrome.runtime.getManifest().version);
	}
}

document.addEventListener("DOMContentLoaded", init);

}

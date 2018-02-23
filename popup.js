{
"use strict";

function onGenerateNewIdentityClick(evt)
{
	chrome.runtime.sendMessage({'action': 'createIdentity' }, result => {
		//console.log("onGenerateNewIdentityClick", result);
		if (result.success)
		{
			$('form#create textarea[name="identity"]').val(result.textualIdentity);
			$('form#create input[name="rescuecode"]').val(result.rescueCode);
			$('form#create input[name="enscryptedrescuecode"]').val(result.enscryptedRescueCode);
		}
	});
}
function onPrintIdentityClick(evt)
{
	let elems = this.form.elements;
	chrome.tabs.create({
		url:"/printidentity.html"
	}, tab => {
		console.log("tab", tab);
	});
}
function onCreateFormSubmit(evt)
{
	evt.preventDefault();
	let elems = this.elements;
	if (elems.verifyrescuecode.value === elems.rescuecode.value)
	{
		elems.verifyrescuecode.setCustomValidity("");
		chrome.runtime.sendMessage({'action': 'importIdentity', "textualIdentity": elems.identity.value, "rescueCode": elems.rescuecode.value, "enscryptedRescueCode": new Uint8Array(JSON.parse(elems.enscryptedrescuecode.value)) }, result => {
			elems[elems.length - 1].parentNode.className = result.success ? "success" : "failure";
			if (result.success)
			{
				elems.identity.value = "";
				elems.rescuecode.value = "";
				elems.verifyrescuecode.value = "";
				elems.enscryptedrescuecode.value = "";
				setPopupState();
			}
		});
	}
	else
		elems.verifyrescuecode.setCustomValidity("Rescue Code mismatch.\nFirst write the Rescue Code down on paper, then enter it here.");
}
function onImportFormSubmit(evt)
{
	evt.preventDefault();
	let elems = this.elements;
	chrome.runtime.sendMessage({'action': 'importIdentity', "textualIdentity": elems.identity.value, "rescueCode": elems.rescuecode.value }, result => {
		//console.log("onImportFormSubmit", result);
		elems[elems.length - 1].parentNode.className = result.success ? "success" : "failure";
		if (result.success)
		{
			elems.identity.value = "";
			elems.rescuecode.value = "";
			$('form#import label+b').text("").attr("title", "");
			setPopupState();
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
		setPopupState();
	});
}
/*
function onRescuecodeRevealClick(evt)
{
	let $input = $('form#create input[name="rescuecode"]');
	$input.attr("type", $input.attr("type" == "password" ? "text" : "password"));
}
*/
function onVerifyrescuecodeFocus(evt)
{
	$('form#create input[name="rescuecode"]').attr("type", "password");
}
function onVerifyrescuecodeBlur(evt)
{
	$('form#create input[name="rescuecode"]').attr("type", "text");
}
function onVerifyrescuecodeKeyUp(evt)
{
	this.setCustomValidity("");
}
function onTextualIdentityKeyUp(evt)
{
	let ta = evt.target;
	//let validationData = validateTextualIdentity(ta.value);
	validateTextualIdentity(ta.value).then(validationData => {;
		$('form#import label+b').text(new Array(validationData.lineNr + 1).join('✅ ') + (validationData.success ? '' : '❌')).attr("title", validationData.message||"");
		$('form#import textarea[name="identity"]')[0].setCustomValidity(validationData.message||"");
	}).catch(err => {
		console.warn("popup.onTextualIdentityKeyUp", "ERRVA000");
	});
}
function setPopupState()
{
	chrome.runtime.sendMessage({'action': 'hasIdentity' }, result => {
		let hasPassword = false;//FIXME
		$('#tab1,#tab2').enable(!result.hasIdentity);
		$('#tab3,#tab6').enable(result.hasIdentity);
		$('#tab4').enable(result.hasIdentity && !hasPassword);
		$('#tab5').enable(hasPassword);
		if (result.hasIdentity)
			$('#identityhash').text(result.name);
		if (result.textualIdentity)
			$('form#export textarea[name="identity"]').val(result.textualIdentity);
	});
}
function init()
{
	// [ form#create, form#import, form#changepassword, form#deletepassword, form#eraseidentity, form#settings ]
	$('button#generateNewIdentity').click(onGenerateNewIdentityClick);
	$('button#printIdentity').click(onPrintIdentityClick);
	$('form#create').submit(onCreateFormSubmit);
	$('form#import').submit(onImportFormSubmit);
	$('form#setpassword').submit(onSetpasswordFormSubmit);
	$('form#changepassword').submit(onChangepasswordFormSubmit);
	$('form#deletepassword').submit(onDeletepasswordFormSubmit);
	$('form#eraseidentity').submit(onEraseidentityFormSubmit);
	//$('form#create input[name="rescuecode"]+b').click(onRescuecodeRevealClick);
	$('form#create input[name="verifyrescuecode"]').focus(onVerifyrescuecodeFocus).blur(onVerifyrescuecodeBlur).keyup(onVerifyrescuecodeKeyUp);
	$('form#import textarea[name="identity"]').keyup(onTextualIdentityKeyUp);
	if ("chrome" in window)
	{
		setPopupState();
		$('#version').text(chrome.runtime.getManifest().version);
	}
}

if ("chrome" in window)
{
	chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
		if (request.action == "createIdentity.enscryptUpdate")
		{
			let prgrss = $('form#create progress').val(request.step)[0];
			if (prgrss && prgrss.max != request.max)
				prgrss.max = request.max;
		}
		else if (request.action == "importIdentity.enscryptUpdate")
		{
			let prgrss = $('form#import progress').val(request.step)[0];
			if (prgrss && prgrss.max != request.max)
				prgrss.max = request.max;
		}
	});
}
document.addEventListener("DOMContentLoaded", init);

}


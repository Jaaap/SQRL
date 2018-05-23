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
	validateTextualIdentity(ta.value).then(validationData => {
		$('form#import label+b').text(new Array(validationData.lineNr + 1).join('✅ ') + (validationData.success ? '' : '❌')).attr("title", validationData.message||"");
		$('form#import textarea[name="identity"]')[0].setCustomValidity(validationData.message||"");
		chrome.runtime.sendMessage({'action': 'importPartialIdentity', "textualIdentity": ta.value}, result => {
			if (!result || !result.success)
			{
				console.log("importPartialIdentity", result);
			}
		});
	}).catch(err => {
		console.warn("popup.onTextualIdentityKeyUp", "ERRVA000", err);
	});
}
function onPrintIdentityClick(evt)
{
	evt.preventDefault();
	window.print();
}




function onCreateFormSubmit(evt)
{
	evt.preventDefault();
	let elems = this.elements;
	if (elems.verifyrescuecode.value === elems.rescuecode.value)
	{
		elems.verifyrescuecode.setCustomValidity("");
		if (elems.verifypassword.value === elems.password.value)
		{
			elems.verifypassword.setCustomValidity("");
			let enscryptedRescueCode = JSON.parse(elems.enscryptedrescuecode.value);
			chrome.runtime.sendMessage({'action': 'importIdentity', "textualIdentity": elems.identity.value, "enscryptedRescueCode": enscryptedRescueCode, "password": elems.password.value }, result => {
				memzero(enscryptedRescueCode);
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
			elems.verifypassword.setCustomValidity("Password mismatch.");
	}
	else
		elems.verifyrescuecode.setCustomValidity("Rescue Code mismatch.\nFirst write the Rescue Code down on paper, then enter it here.");
}
function onImportFormSubmit(evt)
{
	evt.preventDefault();
	let elems = this.elements;
	if (elems.verifypassword.value === elems.password.value)
	{
		elems.verifypassword.setCustomValidity("");
		chrome.runtime.sendMessage({'action': 'importIdentity', "textualIdentity": elems.identity.value, "rescueCode": elems.rescuecode.value, "password": elems.password.value}, result => {
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
	else
		elems.verifypassword.setCustomValidity("Password mismatch.");
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
function onPasswdFormSubmit(evt)
{
	evt.preventDefault();
	let elems = this.elements;
	chrome.runtime.sendMessage({"action": "sendPostDataToActiveTab", "password": elems.password.value, "savepwd": elems.savepwd.checked}, resp => {
		//console.log("popup.onPasswdFormSubmit", "sendPostDataToActiveTab");
		if (resp != null && resp.success && resp.hasOpenRequest)
		{
			window.close();
		}
	});
}
function setPopupState()
{
	chrome.runtime.sendMessage({'action': 'hasIdentity' }, result => {
		$('form#passwd input[name="savepwd"]').val(result.isSavepwd);
		$('#tab1,#tab2').enable(!result.hasIdentity);
		$('#tab3,#tab4,#tab5,#tab6').enable(result.hasIdentity);
		$('#identityhash').text(result.hasIdentity && "name" in result ? result.name : "");
		$('form#export textarea[name="identity"]').val(result.hasIdentity && "textualIdentity" in result ? result.textualIdentity : "");
		if ("partialTextualIdentity" in result && result.partialTextualIdentity != null && result.partialTextualIdentity != "")
		{
			$('form#import textarea[name="identity"]').val(result.partialTextualIdentity);
			$('#tab2')[0].checked = true;
		}
	});
}
function init()
{
	if ("chrome" in window)
	{
		chrome.runtime.sendMessage({'action': 'hasPendingRequest' }, result1 => {
			if (chrome.runtime.lastError)
				console.warn("popup.init", "ERRIN000", "Could not sendMessage hasPendingRequest");
			else if (result1 && result1.hasPendingRequest)
			{
				chrome.runtime.sendMessage({'action': 'hasPassword' }, result2 => {
					if (result2 && result2.hasPassword) //password is known to background
					{
						chrome.runtime.sendMessage({"action": "sendPostDataToActiveTab", "password": null}, resp => {
							//console.log("popup.init", "sendPostDataToActiveTab", resp);
							if (resp != null && resp.success && resp.hasOpenRequest)
							{
								window.close();
							}
						});
					}
					else
					{
						//FIXME: highlight password input
						document.body.classList.add("passwdOnly");
					}
				});
			}
		});
		setPopupState();
		$('#version').text(chrome.runtime.getManifest().version);
	}
	// [ form#create, form#import, form#changepassword, form#deletepassword, form#eraseidentity, form#settings ]
	$('button#generateNewIdentity').click(onGenerateNewIdentityClick);
	$('button#printIdentity').click(onPrintIdentityClick);
	$('form#create').submit(onCreateFormSubmit);
	$('form#import').submit(onImportFormSubmit);
	$('form#changepassword').submit(onChangepasswordFormSubmit);
	$('form#deletepassword').submit(onDeletepasswordFormSubmit);
	$('form#eraseidentity').submit(onEraseidentityFormSubmit);
	//$('form#create input[name="rescuecode"]+b').click(onRescuecodeRevealClick);
	$('form#create input[name="verifyrescuecode"]').focus(onVerifyrescuecodeFocus).blur(onVerifyrescuecodeBlur).keyup(onVerifyrescuecodeKeyUp);
	$('form#import textarea[name="identity"]').keyup(onTextualIdentityKeyUp);
	$('form#passwd').submit(onPasswdFormSubmit);
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


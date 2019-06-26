{
"use strict";

function onGenerateNewIdentityClick(evt)
{
	//console.log("onGenerateNewIdentityClick");
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
function onOpenImportIdentityTab(evt)
{
	chrome.runtime.sendMessage({'action': 'openImportIdentityTab'}, resp => {});
}
function onVerifyrescuecodeFocus(evt)
{
	$('form#create input[name="rescuecode"]').attr("type", "password");
}
function onVerifyrescuecodeBlur(evt)
{
	$('form#create input[name="rescuecode"]').attr("type", "text");
}
function onInputInput(evt)
{
	this.setCustomValidity("");
}
function onTextualIdentityKeyUp(evt)
{
	let ta = evt.target;
	validateTextualIdentity(ta.value, true).then(validationData => {
		$('form#import label+b').text(new Array(validationData.lineNr + 1).join('✅ ') + (validationData.success ? '' : '❌')).attr("title", validationData.message||"");
		$('form#import textarea[name="identity"]')[0].setCustomValidity(validationData.message||"");
		chrome.runtime.sendMessage({'action': 'importPartialIdentity', "textualIdentity": ta.value}, result => {
			if (!result || !result.success)
			{
				console.warn("importPartialIdentity", result);
			}
		});
	}).catch(err => {
		console.warn("popup.onTextualIdentityKeyUp", "ERRVA000", err);
	});
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
			chrome.runtime.sendMessage({'action': 'importIdentity', "textualIdentity": elems.identity.value, "rescueCode": elems.rescuecode.value, "enscryptedRescueCode": enscryptedRescueCode, "password": elems.password.value, "print": true}, result => {
				memzero(enscryptedRescueCode);
				elems[elems.length - 1].parentNode.className = result.success ? "success" : "failure";
				if (result == null)
					showGenericError("onCreateFormSubmit", "ERRCFS--1", "Problem communicating with background");
				else if (result.success)
				{
					/*
					elems.identity.value = "";
					elems.rescuecode.value = "";
					elems.verifyrescuecode.value = "";
					elems.enscryptedrescuecode.value = "";
					setPopupState();
					*/
				}
				else if ("errorCode" in result)
					showGenericError("onCreateFormSubmit", "ERRCFS--1", "Unknown error code " + result.errorCode);
				else
					showGenericError("onCreateFormSubmit", "ERRCFS--2", "Missing error code");
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
		elems[elems.length - 1].parentNode.className = "";
		chrome.runtime.sendMessage({'action': 'importIdentity', "textualIdentity": elems.identity.value, "rescueCode": elems.rescuecode.value, "password": elems.password.value, "print": false}, result => {
			//console.log("onImportFormSubmit", result);
			elems[elems.length - 1].parentNode.className = result.success ? "success" : "failure";
			if (result.success)
			{
				elems.identity.value = "";
				elems.rescuecode.value = "";
				$('form#import label+b').text("").attr("title", "");
				setPopupState();
				$('#tab2')[0].checked = false;
			}
			else if ("errorCode" in result)
			{
				if (result.errorCode == "ERRII004")
					showGenericError("", "", "Invalid Rescue Code");
				else
					showGenericError("onCreateFormSubmit", "ERRIFS--2", "Unknown error code " + result.errorCode);
			}
		});
	}
	else
		elems.verifypassword.setCustomValidity("Password mismatch.");
}
function onChangepasswordFormSubmit(evt)
{
	evt.preventDefault();
	//console.log(this, evt);
}
function onDeletepasswordFormSubmit(evt)
{
	evt.preventDefault();
	//console.log(this, evt);
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
function onSettingsFormSubmit(evt)
{
	evt.preventDefault();
	let elems = this.elements;
	chrome.runtime.sendMessage({'action': 'savePassword', 'savepwd': elems.savepwd.checked }, resp => {
		$('form#settings button').addClass("success");
	});
}
function onPasswdFormSubmit(evt)
{
	evt.preventDefault();
	let elems = this.elements;
	chrome.runtime.sendMessage({"action": "sendPostDataToActiveTab", "password": document.querySelector('form#passwd>label.pwd').classList.contains("hasPassword") == "none" ? null : elems.password.value}, resp => {
		//console.log("popup.onPasswdFormSubmit", "sendPostDataToActiveTab", JSON.stringify(resp));
		if (resp == null)
			showGenericError("onPasswdFormSubmit", "ERRPFS--1", "Problem communicating with background");
		else
		{
			if (resp.success)
			{
				if (resp.hasOpenRequest)
					window.close();
				else
					elems.password.value = "";
			}
			else if ("errorCode" in resp)
			{
				if (resp.errorCode == "ERRGI003")//"ERRPD008")
					showPasswordError(elems.password);
				else
					showGenericError("onPasswdFormSubmit", "ERRPFS--2", "Unknown error code " + resp.errorCode);
			}
			else
				showGenericError("onPasswdFormSubmit", "ERRPFS--3", "Missing error code");
		}
	});
}
function setPopupState()
{
	chrome.runtime.sendMessage({'action': 'hasIdentity' }, result => {
		//$('form#passwd input').enable(result.hasIdentity).val(result.hasPassword ? "........" : "");
		$('form#settings input[name="savepwd"]').val(result.isSavepwd);
		$('#tab1,#tab2').enable(!result.hasIdentity);
		$('#tab3,#tab4,#tab5,#tab6').enable(result.hasIdentity);
		$('#identityhash').text(result.hasIdentity && "textualIdentity" in result ? result.textualIdentity.substr(0, 4) : "");
		$('form#export textarea[name="identity"]').val(result.hasIdentity && "textualIdentity" in result ? result.textualIdentity : "");
		if (result.hasIdentity && "textualIdentity" in result)
		{
			let identity = parseTextualIdentity(result.textualIdentity);
			let qrData = new Uint8Array(identity.length + 8);
			qrData.set([115,113,114,108,100,97,116,97], 0);//'sqrldata'
			qrData.set(identity, 8);//'sqrldata'
			makeQR(document.querySelector('form#export img#exportqr'), qrData);
		}
		if ("partialTextualIdentity" in result && result.partialTextualIdentity != null && result.partialTextualIdentity != "")
		{
			let ta = document.querySelector('form#import textarea[name="identity"]');
			ta.value = result.partialTextualIdentity;
			document.querySelector('#tab2').checked = true;
			onTextualIdentityKeyUp({"target": ta});
		}
	});
}

function onInputInputValidate(evt)
{
	evt.target.setCustomValidity('');
	evt.target.checkValidity();
}
function onInputInvalidValidate(evt)
{
	evt.target.setCustomValidity(evt.target.getAttribute("data-errormessage"));
}
function init()
{
	if ("chrome" in window && "runtime" in chrome)
	{
		chrome.runtime.sendMessage({'action': 'hasPendingRequest' }, result => { //{"success": true, "hasPendingRequest": true, "hasPassword": true, "isSameOrigin": false, "linkOrigin": "http://a.com:8080"}
			if (chrome.runtime.lastError)
				console.warn("popup.init", "ERRIN000", "Could not sendMessage hasPendingRequest");
			else if (result && result.hasPendingRequest)
			{
				document.body.classList.add("passwdOnly");
				$('form#passwd>code').text(result.linkOrigin.replace(/^https:\/\//, "")).toggleClass("warn", !result.isSameOrigin);
				$('form#passwd>label.pwd').toggleClass("hasPassword", result.hasPassword);
				if (result.isSameOrigin)
				{
					if (result.hasPassword) //password is known to background
					{
						chrome.runtime.sendMessage({"action": "sendPostDataToActiveTab", "password": null}, resp => {
							//console.log("popup.init", "sendPostDataToActiveTab", resp);
							if (resp != null && resp.success && resp.hasOpenRequest)
							{
								window.close();
							}
						});
					}
				}
			}
		});
		setPopupState();
		$('#version').text(chrome.runtime.getManifest().version);
	}
	// [ form#create, form#import, form#changepassword, form#deletepassword, form#eraseidentity, form#settings ]
	$('form#create').submit(onCreateFormSubmit);
	$('button#generateNewIdentity').click(onGenerateNewIdentityClick);
	$('form#import').submit(onImportFormSubmit);
	$('button#openImportIdentityTab').click(onOpenImportIdentityTab);
	$('form#changepassword').submit(onChangepasswordFormSubmit);
	$('form#deletepassword').submit(onDeletepasswordFormSubmit);
	$('form#eraseidentity').submit(onEraseidentityFormSubmit);
	$('form#create input[name="verifyrescuecode"]').focus(onVerifyrescuecodeFocus).blur(onVerifyrescuecodeBlur).bind("input", onInputInput);
	$('form input[name="verifypassword"]').bind("input", onInputInput);
	$('form#import textarea[name="identity"]').keyup(onTextualIdentityKeyUp);
	$('form#settings').submit(onSettingsFormSubmit);
	$('form#passwd').submit(onPasswdFormSubmit);
	$('input[data-errormessage]').bind("input", onInputInputValidate).bind("invalid", onInputInvalidValidate);
}

if ("chrome" in window && "runtime" in chrome)
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


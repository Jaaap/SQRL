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
	//let validationData = validateTextualIdentity(ta.value);
	validateTextualIdentity(ta.value).then(validationData => {
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
function onIdentityfileChange(evt)
{
	let input = evt.target;
	let errorText = "";
	if (input.files.length)
	{
		if (input.files.length == 1)
		{
			let file = input.files[0];
			if (file.name.endsWith(".sqrc") || file.name.endsWith(".sqrl"))
			{
				if (file.name.endsWith(".sqrc") && [81, 135, 167, 199, 231].indexOf(file.size) == -1)
					errorText = "Invalid .sqrc file selected. Size of the file should be 81, 135, 167, 199 or 231 bytes.";
				else if (file.name.endsWith(".sqrl") && [206, 260, 292, 324, 356].indexOf(file.size) == -1)
					errorText = "Invalid .sqrl file selected. Size of the file should be 206, 260, 292, 324 or 356 bytes.";
				else
				{
					let reader = new FileReader();
					reader.onload = function(evt) {
						let data = evt.target.result;//ArrayBuffer
						let array = new Uint8Array(data);
						//console.log(array);
						if ([81, 135, 167, 199, 231, 206, 260, 292, 324, 356].indexOf(array.length) > -1)
						{
							if (ab2str(array.slice(0,8)) == "sqrldata")
							{
								//Ignore the first 8 (.sqrc) or 133 (.sqrl) bytes and convert the rest to base56
								addVerificationAndWhitespaceToTextualIdentity(base56encode(array.slice(file.name.endsWith(".sqrc") ? 8 : 133).reverse())).then(ti => {
									let ta = document.querySelector('form#import textarea[name="identity"]');
									ta.value = ti;
									onTextualIdentityKeyUp({target:ta});
								});
							}
							else
								errorText = "Invalid .sqrl file selected. File should start with string 'sqrldata'.";
						}
						else
							errorText = "Invalid .sqrl file selected. Size of the file should be 81, 135, 167, 199, 231, 206, 260, 292, 324 or 356 bytes.";
					};
					reader.readAsArrayBuffer(file);
				}
			}
			else
				errorText = "Invalid file selected. Filename should end in '.sqrl' or '.sqrc'.";
		}
		else
			errorText = "More than one file selected.\nSelect only 1 file.";
	}
	input.setCustomValidity(errorText);
	input.reportValidity();
}

function drawLine(canvas, begin, end, color)//FIXME: move to utils
{
	canvas.beginPath();
	canvas.moveTo(begin.x, begin.y);
	canvas.lineTo(end.x, end.y);
	canvas.lineWidth = 4;
	canvas.strokeStyle = color;
	canvas.stroke();
}
function onQrscanClick(evt)
{
	let video = document.createElement("video");
	let canvasElement = document.getElementById("qrcanvas");
	let canvas = canvasElement.getContext("2d");
	let stream;

	navigator.mediaDevices.getUserMedia({ "audio": false, "video": true }).then(function(strm) {
		canvasElement.style.display = "block";
		stream = strm;
		video.srcObject = strm;
		video.setAttribute("playsinline", true); // required to tell iOS safari we don't want fullscreen
		video.play();
		requestAnimationFrame(tick);
	}).catch(function(err){
		let os = chrome.runtime.getPlatformInfo().os;
console.error(err, os);
		if (err.name == "NotFoundError")
			alert("No Camera found.\nIf you do have a Camera, make sure the browser is allowed to use it.");//FIXME: "System Preferences > Security & Privacy > Privacy > Camera > Firefox.app"
		else if (err.name == "NotAllowedError")
			alert("There is no permission to use the Camera.\nSee about:preferences#privacy");//FIXME: Chrome
		else
			alert("Error accessing Webcam for video:\n" + err.name + "\n\n" + err.message);
	});

	function tick()
	{
		let done = false;
		if (video.readyState === video.HAVE_ENOUGH_DATA)
		{
			//FIXME: set all these heights and widths only once, when UserMedia is loaded
			canvasElement.height = video.videoHeight;
			canvasElement.width = video.videoWidth;
			canvas.drawImage(video, 0, 0, canvasElement.width, canvasElement.height);
			let imageData = canvas.getImageData(0, 0, canvasElement.width, canvasElement.height);
			let code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" });
			if (code)
			{
				drawLine(canvas, code.loc.topLeftCorner, code.loc.topRightCorner, "#FF3B58");
				drawLine(canvas, code.loc.topRightCorner, code.loc.bottomRightCorner, "#FF3B58");
				drawLine(canvas, code.loc.bottomRightCorner, code.loc.bottomLeftCorner, "#FF3B58");
				drawLine(canvas, code.loc.bottomLeftCorner, code.loc.topLeftCorner, "#FF3B58");
				document.querySelector('form#import textarea[name="identity"]').value = code.data;
				video.pause();
				video.srcObject = null;
				done = true;
				stream.getTracks().forEach(track => track.stop());
				setTimeout(function(){
					canvas.fillStyle = "blue";
					canvas.fillRect(0, 0, canvasElement.width, canvasElement.height);
					canvasElement.style.display = "none";
				}, 500);
			}
		}
		if (!done)
			requestAnimationFrame(tick);
	}
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
	chrome.runtime.sendMessage({'action': 'savePassword', 'savepwd': elems.savepwd.checked }, resp => {});
}
function onPasswdFormSubmit(evt)
{
	evt.preventDefault();
	let elems = this.elements;
	chrome.runtime.sendMessage({"action": "sendPostDataToActiveTab", "password": elems.password.value}, resp => {
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
		$('form#passwd input').enable(result.hasIdentity).val(result.hasPassword ? "........" : "");
		$('form#settings input[name="savepwd"]').val(result.isSavepwd);
		$('#tab1,#tab2').enable(!result.hasIdentity);
		$('#tab3,#tab4,#tab5,#tab6').enable(result.hasIdentity);
		$('#identityhash').text(result.hasIdentity && "textualIdentity" in result ? result.textualIdentity.substr(0, 4) : "");
		$('form#export textarea[name="identity"]').val(result.hasIdentity && "textualIdentity" in result ? result.textualIdentity : "");
		if ("partialTextualIdentity" in result && result.partialTextualIdentity != null && result.partialTextualIdentity != "")
		{
			$('form#import textarea[name="identity"]').val(result.partialTextualIdentity);
			$('#tab2')[0].checked = true;
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
	if ("browser" in window)
	{
		//FIXME: remove this when bug 1366330 is fixed
		$('form#import input[name="identityfile"]').enable(false).parent().addClass("notyet");
	}
	// [ form#create, form#import, form#changepassword, form#deletepassword, form#eraseidentity, form#settings ]
	$('button#generateNewIdentity').click(onGenerateNewIdentityClick);
	$('form#create').submit(onCreateFormSubmit);
	$('form#import').submit(onImportFormSubmit);
	$('form#changepassword').submit(onChangepasswordFormSubmit);
	$('form#deletepassword').submit(onDeletepasswordFormSubmit);
	$('form#eraseidentity').submit(onEraseidentityFormSubmit);
	$('form#create input[name="verifyrescuecode"]').focus(onVerifyrescuecodeFocus).blur(onVerifyrescuecodeBlur).bind("input", onInputInput);
	$('form input[name="verifypassword"]').bind("input", onInputInput);
	$('form#import textarea[name="identity"]').keyup(onTextualIdentityKeyUp);
	$('form#import input[name="identityfile"]').change(onIdentityfileChange);
	$('form#import button[name="qrscan"]').click(onQrscanClick);
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


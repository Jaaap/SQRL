{
"use strict";

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
						try {
							binary2textual(array);
						} catch (err) {
							errorText = err;
						}
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
function binary2textual(array)
{
	//console.log(array);
	if ([81, 135, 167, 199, 231, 206, 260, 292, 324, 356].indexOf(array.length) > -1)
	{
		if (ab2str(array.slice(0,8)) == "sqrldata")
		{
			//Ignore the first 8 (.sqrc) or 133 (.sqrl) bytes and convert the rest to base56
			let ignoreBytes = [206, 260, 292, 324, 356].indexOf(array.length) > -1 ? 133 : 8;
			addVerificationAndWhitespaceToTextualIdentity(base56encode(array.slice(ignoreBytes).reverse())).then(ti => {
				let ta = document.querySelector('form#import textarea[name="identity"]');
				ta.value = ti;
				//onTextualIdentityKeyUp({target:ta});
			});
		}
		else
			throw new Error("Invalid sqrl data. Data should start with string 'sqrldata'");
	}
	else
		throw new Error("Invalid sqrl data. Size of the data should be 81, 135, 167, 199, 231, 206, 260, 292, 324 or 356 bytes");
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
let qrOsErrorText = {
	"mac":	{"NotFoundError":'For macOS, go to System Preferences > Security & Privacy > Privacy > Camera and check the box for this browser',"NotAllowedError":""},
	"win":	{"NotFoundError":"","NotAllowedError":""},
	"cros":	{"NotFoundError":"","NotAllowedError":""},
	"android":	{"NotFoundError":"","NotAllowedError":""},
	"linux":	{"NotFoundError":"","NotAllowedError":""},
	"openbsd":	{"NotFoundError":"","NotAllowedError":""}
};
let qrBrowserErrorText = {
"firefox":	{"NotFoundError":"","NotAllowedError":"In Firefox, go to Preferences > Privacy & Security > Permissions > Camera."},
"opera":	{"NotFoundError":"","NotAllowedError":""},
"chrome":	{"NotFoundError":"","NotAllowedError":"In Chrome, go to Settings > Privacy and security > Site settings > Camera."},
"edge":	{"NotFoundError":"","NotAllowedError":""}
};
let stopQrScan = false;
function onQrscanClick(evt)
{
	stopQrScan = false;
	let video = document.createElement("video");
	//<div id="qrscan"><button id="cancelqrscan" type="button">Cancel</button><canvas id="qrcanvas"></canvas></div>
	$('div#qrscan').addClass("show");
	let canvasElement = document.getElementById("qrcanvas");
	let canvas = canvasElement.getContext("2d");
	let stream;

	navigator.mediaDevices.getUserMedia({ "audio": false, "video": true }).then(function(strm) {
		stream = strm;
		video.srcObject = strm;
		video.setAttribute("playsinline", true); // required to tell iOS safari we don't want fullscreen
		video.play();
		requestAnimationFrame(tick);
	}).catch(function(err){
		let os = "mac";//("chrome" in window && "runtime" in chrome) ? chrome.runtime.getPlatformInfo().os : "mac"; //"mac", "win", "android", "cros", "linux", or "openbsd"//FIXME
		let browser = getBrowser(); //"firefox","edge","opera","chrome";
//console.error(err, os, browser);
		if (err.name == "NotFoundError")
			alert("No Camera found.\nIf you do have a Camera, make sure the browser is allowed to use it.\n\n" + qrOsErrorText[os].NotFoundError);//FIXME: "System Preferences > Security & Privacy > Privacy > Camera > Firefox.app"
		else if (err.name == "NotAllowedError")
			alert("There is no permission to use the Camera.\n\n" + qrBrowserErrorText[browser].NotAllowedError);
		else
			alert("Error accessing Webcam for video:\n" + err.name + "\n\n" + err.message);
	});

	function tick()
	{
		if (video.readyState === video.HAVE_ENOUGH_DATA)
		{
			//FIXME: set all these heights and widths only once, when UserMedia is loaded
			canvasElement.height = video.videoHeight;
			canvasElement.width = video.videoWidth;
			canvas.drawImage(video, 0, 0, canvasElement.width, canvasElement.height);
			let imageData = canvas.getImageData(0, 0, canvasElement.width, canvasElement.height);
			let code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" });
			if (code && code.binaryData)
			{
				drawLine(canvas, code.loc.topLeftCorner, code.loc.topRightCorner, "#FF3B58");
				drawLine(canvas, code.loc.topRightCorner, code.loc.bottomRightCorner, "#FF3B58");
				drawLine(canvas, code.loc.bottomRightCorner, code.loc.bottomLeftCorner, "#FF3B58");
				drawLine(canvas, code.loc.bottomLeftCorner, code.loc.topLeftCorner, "#FF3B58");
				//document.querySelector('form#import textarea[name="identity"]').value = code.binaryData;
				binary2textual(new Uint8Array(code.binaryData));
				stopQrScan = true;
			}
		}
		if (stopQrScan)
		{
			video.pause();
			video.srcObject = null;
			stream.getTracks().forEach(track => track.stop());
			setTimeout(function(){
				canvas.fillStyle = "blue";
				canvas.fillRect(0, 0, canvasElement.width, canvasElement.height);
				$('div#qrscan').removeClass("show");
			}, 500);
		}
		else
			requestAnimationFrame(tick);
	}
}
function onCancelqrscanClick(evt)
{
	stopQrScan = true;
}
function onImportFormSubmit(evt)
{
	evt.preventDefault();
	let ta = document.querySelector('form#import textarea[name="identity"]');
	chrome.runtime.sendMessage({'action': 'importPartialIdentity', "textualIdentity": ta.value, 'closeTab': true}, result => {
		if (!result || !result.success)
			alert("Submit failed\n\n" + JSON.stringify(result, null, "\t"));
	});
}

function init()
{
	if ("chrome" in window && "runtime" in chrome)
	{
		//chrome.runtime.sendMessage({'action': 'hasPendingRequest' }, result1 => { });
	}
	$('form#import input[name="identityfile"]').change(onIdentityfileChange);
	$('form#import button[name="qrscan"]').click(onQrscanClick);
	$('form#import button#cancelqrscan').click(onCancelqrscanClick);
	$('form#import').submit(onImportFormSubmit);
}
if ("chrome" in window && "runtime" in chrome)
{
	chrome.runtime.onMessage.addListener(request => {
		console.log(request);
		//if (request && request.action == "FIXME") { }
	});
}

document.addEventListener("DOMContentLoaded", init);

}


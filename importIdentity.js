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
						//console.log(array);
						if ([81, 135, 167, 199, 231, 206, 260, 292, 324, 356].indexOf(array.length) > -1)
						{
							if (ab2str(array.slice(0,8)) == "sqrldata")
							{
								//Ignore the first 8 (.sqrc) or 133 (.sqrl) bytes and convert the rest to base56
								addVerificationAndWhitespaceToTextualIdentity(base56encode(array.slice(file.name.endsWith(".sqrc") ? 8 : 133).reverse())).then(ti => {
									let ta = document.querySelector('form#import textarea[name="identity"]');
									ta.value = ti;
									//onTextualIdentityKeyUp({target:ta});
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
		//let os = chrome.runtime.getPlatformInfo().os;
//console.error(err, os);
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
function onImportFormSubmit(evt)
{
	evt.preventDefault();
	let ta = document.querySelector('form#import textarea[name="identity"]');
	chrome.runtime.sendMessage({'action': 'importPartialIdentity', "textualIdentity": ta.value}, result => {
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


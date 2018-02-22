{
"use strict";

function hasBitSet(btmp, mask)
{
	if (typeof btmp == "string")
		btmp = 1 * btmp;
	if (typeof btmp == "number")
	{
		if (typeof mask == "number")
		{
			return (btmp & mask) == mask;
		}
		else
			throw new Error('Argument 1 "mask" should be a number');
	}
	else
		throw new Error('Argument 1 "btmp" should be a string or a number');
}
function base64url_decode(data)
{
	if (data.length % 4 > 0)
	{
		//padd width equal signs
		data = data + new Array(5 - (data.length % 4)).join("=");
	}
	let b64u = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";   // base64url dictionary
	let dst = "";

	for (let i = 0; i < data.length - 3; i += 4)
	{
		let a = b64u.indexOf(data.charAt(i+0));
		let b = b64u.indexOf(data.charAt(i+1));
		let c = b64u.indexOf(data.charAt(i+2));
		let d = b64u.indexOf(data.charAt(i+3));

		dst += String.fromCharCode((a << 2) | (b >>> 4));
		if (data.charAt(i+2) != '=')
			dst += String.fromCharCode(((b << 4) & 0xF0) | ((c >>> 2) & 0x0F));
		if (data.charAt(i+3) != '=')
			dst += String.fromCharCode(((c << 6) & 0xC0) | d);
	}
	return decodeURIComponent(escape(dst));
}

function ajax(url, postData, callback)
{
console.log("content.ajax", url, postData);
	fetch(url, {
		"body": postData,
		"cache": "no-cache", // *default, no-cache, reload, force-cache, only-if-cached
		"credentials": "omit", // include, *omit, same-origin
		"headers": {
			"content-type": "application/x-www-form-urlencoded"
		},
		"method": "POST", // *GET, PUT, DELETE, etc.
		"mode": "same-origin", // no-cors, *same-origin, cors
		"redirect": "error" // *manual, follow, error
		//"referer": "client", // *client, no-referrer
	}).then(resp => resp.text()).then(callback).catch(err => {
		console.warn("fetch", err);
	});
}

function onAjaxCallback(responseText, anchor)
{
console.log("onAjaxCallback", responseText);
	let responseLines = base64url_decode(responseText).split("\r\n");
console.log("onAjaxCallback", responseLines);
	let responseMap = {};
	for (let line of responseLines)
	{
		let eqPos = line.indexOf("=");
		if (eqPos > -1)
			responseMap[line.substring(0,eqPos)] = line.substr(eqPos + 1);
		else
			console.warn("content.onAjaxCallback", "Expected equals sign in server response line");
	}
	if ("tif" in responseMap)
	{
		if (!hasBitSet(responseMap.tif, 4))
		{
			chrome.runtime.sendMessage({"action": "content.error.ipmismatch"}, result => { });
			anchor.style.cssText = "border: 2px solid red; background-color: #FFF; color: #000;";
			anchor.appendChild(document.createTextNode("- IP Mismatch Detected -"));
			// IP MISMATCH DETECTED
			return;
		}
	}
	else
		console.error("onAjaxCallback", "No tif found in server response");

	if ("url" in responseMap)
		window.location.href = responseMap.url;
	else
		console.error("onAjaxCallback", "No url found in server response");
}

function onAnchorClick(evt)
{
	evt.preventDefault();
	let anchor = evt.target;
	while (anchor && anchor.tagName != "A")
		anchor = anchor.parentNode;
	//TODO: check meta/ctrl/middleclick?
	if (anchor.tagName == "A")
	{
		chrome.runtime.sendMessage({"action": "getPostData", "href": anchor.href}, result => {
			//console.log(result);
			if (result.success)
				ajax(anchor.href.replace(/^sqrl:/, 'https:'), result.postData, respTxt => { onAjaxCallback(respTxt, anchor); });
		});
	}
}

//assume DOMLoaded
[].forEach.call(document.querySelectorAll('a[href^="sqrl://"]'), anchor => {
	anchor.addEventListener("click", onAnchorClick, false);
});
}


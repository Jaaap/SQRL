{
"use strict";
function isValidHostname(hn)
{
	//FIXME: it is assumed that the hostname is punycode encoded - test and/or fix this
	/*
	Hostnames are composed of series of labels concatenated with dots, as are all domain names.
	For example, "en.wikipedia.org" is a hostname. Each label must be between 1 and 63 characters long, and the entire hostname has a maximum of 255 characters.
	RFCs mandate that a hostname's labels may contain only the ASCII letters 'a' through 'z' (case-insensitive), the digits '0' through '9', and the hyphen. Hostname labels cannot begin or end with a hyphen. No other symbols, punctuation characters, or blank spaces are permitted.
	*/
	if (hn == null || typeof hn != "string" || hn.length == 0 || hn.length  > 255 || !/^[a-zA-Z0-9\.\-]+$/.test(hn))
		return false;
	let splt = hn.split(".");
	for (let lbl of splt)
		if (lbl.length < 1 || lbl.length > 63 || lbl.startsWith('-') || lbl.endsWith('-'))
			return false;
	return true;
}


function getPostData(href)
{
	if (typeof href == "string" && href.startsWith("sqrl://"))
	{
		let hurl = new URL(href.replace(/^sqrl:/, 'https:'));
		if (hurl != null && isValidHostname(hurl.hostname))
		{
			//let masterKey = sodium.from_hex('F33CCDFAFED8DFD2A2BE0A5B84D435B0641D52BB6BF4D7E3067B12CA4DDB0B32');
			//FIXME: do the keygen only on "Create Identity" and store it in browser.storage.local
			let masterKey = sodium.crypto_auth_keygen();

			let HMAC256Hash = sodium.crypto_auth_hmacsha256(hurl.hostname, masterKey);
			sodium.memzero(masterKey);

			let { publicKey: SitePublicKey,  privateKey: SitePrivateKey } = sodium.crypto_sign_seed_keypair(HMAC256Hash);
			sodium.memzero(HMAC256Hash);

			let client = base64url([
				"ver=1",
				"cmd=ident",
				"idk=" + sodium.to_base64(SitePublicKey),
				"opt=cps",
				"" //keep this empty string for trailing \r\n
			].join("\r\n"));
			sodium.memzero(SitePublicKey);

			let server = base64url(href);
			let ids = sodium.crypto_sign_detached(client + server, SitePrivateKey, 'base64');
			sodium.memzero(SitePrivateKey);

			return ["client=" + encodeURIComponent(client), "server=" + encodeURIComponent(server), "ids=" + encodeURIComponent(ids)].join('&');
		}
		else
			throw 'getPostData: ERROR. Argument 1 "href" should be a string containing a valid URL with hostname';
	}
	else
		throw 'getPostData: ERROR. Argument 1 "href" should be a string starting with "sqrl://"';
}


chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
	if (sender.tab) //from content
	{
		if (request.action === "getPostData")
		{
			sendResponse(getPostData(request.href));
			//chrome.browserAction.setBadgeText({"text": "*", "tabId": sender.tab.id});
		}
	}
/*
	else //from popup
	{
		if (request.action === "vault.get")
		{
			sendResponse(vaultObj.get());
		}
	}
*/
});
}

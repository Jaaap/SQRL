{
"use strict";
let localSodium = null, IMK = null, textualIdentity = null, sodiumLoadQueue = [];
window.sodium = { onload: sod => {
	localSodium = sod;
	for (func of sodiumLoadQueue)
	{
		func();
	}
	sodiumLoadQueue = [];
}};


function showBadgeError(txt, animateCount, tabId)//animateCount must be even
{
	chrome.browserAction.setBadgeText({"text": animateCount % 2 ? "" : txt, "tabId": tabId});
	if (animateCount > 0)
	{
		setTimeout(function(){ showBadgeError(txt, animateCount - 1, tabId); }, 300);
	}
}

function getPostDataAsync(href, sendResponse, tabId)
{
	//console.log("backgroud.getPostDataAsync", href);
	if (typeof href == "string" && href.startsWith("sqrl://"))
	{
		let hurl = new URL(href.replace(/^sqrl:/, 'https:'));
		if (hurl != null && isValidHostname(hurl.hostname))
		{
			if (IMK == null)
			{
				showBadgeError("IDTY", 6, tabId);
				sendResponse({"success": false, "errorCode": "ERRPD003"});
				return true;
			}
			else
			{
				showBadgeError("", 0, tabId);
				var work = (href, hurl) => {
					let HMAC256Hash = localSodium.crypto_auth_hmacsha256(hurl.hostname, IMK);

					let { publicKey: SitePublicKey,  privateKey: SitePrivateKey } = localSodium.crypto_sign_seed_keypair(HMAC256Hash);
					memzero(HMAC256Hash);

					let client = base64url_encode(localSodium, [
						"ver=1",
						"cmd=ident",
						"idk=" + localSodium.to_base64(SitePublicKey),
						"opt=cps",
						"" //keep this empty string for trailing \r\n
					].join("\r\n"));
					memzero(SitePublicKey);

					let server = base64url_encode(localSodium, href);
					let ids = localSodium.crypto_sign_detached(client + server, SitePrivateKey, 'base64');
					memzero(SitePrivateKey);

					sendResponse({"success": true, "postData": ["client=" + encodeURIComponent(client), "server=" + encodeURIComponent(server), "ids=" + encodeURIComponent(ids)].join('&')});
				};
				if (localSodium == null) //Fennec
				{
					sodiumLoadQueue.push(function(){
						work(href, hurl);
					});
					return false;
				}
				else
				{
					work(href, hurl);
					return true;
				}
			}
		}
		else
		{
			sendResponse({"success": false, "errorCode": "ERRPD002"});
			return true;
		}
	}
	else
	{
		sendResponse({"success": false, "errorCode": "ERRPD001"});
		return true;
	}
}
function createIdentity(sendResponse)
{
	let newIUK = localSodium.randombytes_buf(32);
	//let newIMK = enhash(localSodium, newIUK);
	let enscryptSalt = localSodium.randombytes_buf(16);
	let enscryptIter = 120;
	let enscryptLogN = 9;
	let newRescueCode = [];
	let additionalData = new Uint8Array(25);
	additionalData.set([73, 0, 2, 0], 0);
	additionalData.set(enscryptSalt, 4);
	additionalData.set([enscryptLogN, enscryptIter, 0, 0, 0], 20);//FIXME: only works when enscryptIter < 256
	for (let i = 0; i < 6; i++)
	{
		newRescueCode.push(zeropad(sodium.randombytes_uniform(10000), 4));
	}
	enscrypt(localSodium.crypto_pwhash_scryptsalsa208sha256_ll, str2ab(newRescueCode.join("")), enscryptSalt, enscryptLogN, enscryptIter, (step, max) => {
		chrome.runtime.sendMessage({'action': 'createIdentity.enscryptUpdate', "step": step, "max": max});
	}).then(enscryptedNewRescueCode => {
		aesGcmEncrypt(newIUK, additionalData, enscryptedNewRescueCode, new Uint8Array(12)).then(dataToDecrypt => {
			memzero(newIUK);
			try {
				serializeBlock2(dataToDecrypt, additionalData).then(newTextualIdentity => {
					sendResponse({"success": true, "textualIdentity": newTextualIdentity, "rescueCode": newRescueCode.join("-"), "enscryptedRescueCode": JSON.stringify(Array.from(enscryptedNewRescueCode))});
				}).catch(err => {
					sendResponse({"success": false, "errorCode": "ERRCI004"});
				});
			}
			catch (err)
			{
				sendResponse({"success": false, "errorCode": "ERRCI003"});
			}
		}).catch(err => {
			sendResponse({"success": false, "errorCode": "ERRCI002"});
		});
	}).catch(err => {
		sendResponse({"success": false, "errorCode": "ERRCI001"});
	});
}
function importIdentity(ti, rescueCode, enscryptedRescueCode, sendResponse)
{
	validateTextualIdentity(ti).then(validationResult => {  //will also return success == true if the textual identity is only partly entered!
		if (validationResult.success)
		{
			try
			{
				let extractedBlock2 = parseBlockType2(ti);
				textualIdentity = ti;
				chrome.storage.local.set({"textualIdentity": ti});
				//console.log("rescueCode", JSON.stringify(Array.from(rescueCode)), rescueCode.length);
				let prms = enscryptedRescueCode == null ?  enscrypt(localSodium.crypto_pwhash_scryptsalsa208sha256_ll, str2ab(rescueCode.replace(/[^0-9]/g, "")), extractedBlock2.enscryptSalt, extractedBlock2.enscryptLogN, extractedBlock2.enscryptIter, (step, max) => {
					chrome.runtime.sendMessage({'action': 'importIdentity.enscryptUpdate', "step": step, "max": max}, result => {/* do nothing */});
				}) : new Promise(resolve => resolve(enscryptedRescueCode));
				prms.then(enscryptedPwd => {
					//console.log("enscryptedPwd", JSON.stringify(Array.from(enscryptedPwd)));
					aesGcmDecrypt(extractedBlock2.dataToDecrypt, extractedBlock2.additionalData, enscryptedPwd, new Uint8Array(12)).then(decrypted => {
						let IUK = new Uint8Array(decrypted);
						IMK = enhash(localSodium, IUK);
						memzero(IUK);
						//FIXME: encrypt IMK with password
						chrome.storage.local.set({"IMK": Array.from(IMK)});
						sendResponse({"success": true, "name": ab2hex(localSodium.crypto_hash_sha256(IMK)).substr(0,8)});
					}).catch(err => {
						sendResponse({"success": false, "errorCode": "ERRII004"});
					});
				}).catch(err => {
					sendResponse({"success": false, "errorCode": "ERRII003"});
				});
			}
			catch(err)
			{
				sendResponse({"success": false, "errorCode": "ERRII002"});
			}
		}
		else
			sendResponse({"success": false, "errorCode": "ERRII001"});
	}).catch(err => {
		sendResponse({"success": false, "errorCode": "ERRII000"});
	});
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
	/* for content.js */
	if (request.action === "getPostData")
	{
		let hasCalledSendresponse = getPostDataAsync(request.href, sendResponse, sender.tab ? sender.tab.id : null);
		if (!hasCalledSendresponse)
			return true; // make asynchronous
	}
	/* for popup.js */
	//FIXME: find a way to make sure these requests are not coming from content.js but from popup.js
	else if (request.action === "hasIdentity")
	{
		if (IMK == null)
		{
			sendResponse({"hasIdentity": false});
		}
		else
		{
			crypto.subtle.digest('SHA-256', IMK).then(sha256result => {
				sendResponse({"hasIdentity": true, "name": ab2hex(sha256result).substr(0,8), "textualIdentity": textualIdentity});
			}).catch(err => {
				console.warn("background.hasIdentity", "ERRHI000");
			});
			return true;
		}
	}
	else if (request.action === "eraseIdentity")
	{
		IMK = null;
		chrome.storage.local.remove(["IMK","identityDataType2"], () => {
			sendResponse(chrome.runtime.lastError);
		});
		return true;
	}
	else if (request.action === "createIdentity")
	{
		createIdentity(sendResponse);
		return true;
	}
	else if (request.action === "importIdentity")
	{
		importIdentity(request.textualIdentity, request.rescueCode, request.enscryptedRescueCode, sendResponse);
		return true;
	}
	else
		console.warn("background", "request action not recognised", request.action);
});

chrome.storage.local.get(["IMK", "textualIdentity"], function(result){
	if (result.IMK)
	{
		IMK = new Uint8Array(result.IMK);
		memzero(result.IMK);
	}
	if (result.textualIdentity)
	{
		textualIdentity = result.textualIdentity;
	}
});
}


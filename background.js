{
"use strict";
let localSodium = null, textualIdentity = null, partialTextualIdentity = null, getPostDataQueue = {}, importIdentityTabId;

let sodiumPromise = new Promise((resolve, reject) => {
	window.sodium = { onload: sod => {
		localSodium = sod;
		resolve();
	}};
})



let savepwd = false, IMK = null, ILK = null, passIv = null, passwordEnscrypted = null, passwordEnscryptSalt = null, passwordEnscryptLogN = 9, passwordEnscryptIter = 1;

chrome.storage.local.get(["encrIMK", "encrILK", "passIv", "passwordEnscryptSalt", "savepwd", "textualIdentity"], function(result){
	if (chrome.runtime.lastError)
		console.warn("chrome.storage.local.get", chrome.runtime.lastError, result);
	if (result.encrIMK && result.encrILK && result.passIv && result.passwordEnscryptSalt)
	{
		IMK = new Uint8Array(result.encrIMK);
		ILK = new Uint8Array(result.encrILK);
		passIv = new Uint8Array(result.passIv);
		passwordEnscryptSalt = new Uint8Array(result.passwordEnscryptSalt);
		memzero(result.encrIMK);
		memzero(result.encrILK);
		delete result.encrIMK;
		delete result.encrILK;
	}
	//else console.info("background.getStorage", "ERRGS000", "encrIMK or encrILK or passIv or passwordEnscryptSalt not in localStorage");
	if (result.textualIdentity)
	{
		textualIdentity = result.textualIdentity;
	}
	if (result.savepwd)
	{
		savepwd = result.savepwd;
	}
});
function setSavepwd(newSavepwd)
{
//console.log("setSavepwd", newSavepwd);
	savepwd = newSavepwd;
	if (!newSavepwd)//clear passwd from memory
	{
		memzero(passwordEnscrypted);
		passwordEnscrypted = null;
	}
	chrome.storage.local.set({"savepwd": newSavepwd}, () => {
		if (chrome.runtime.lastError)
			console.warn("chrome.storage.local.set", chrome.runtime.lastError);
	});
}
function hasIMK()
{
	return IMK != null && passIv != null && passwordEnscryptSalt != null;
}
function hasILK()
{
	return ILK != null && passIv != null && passwordEnscryptSalt != null;
}
async function getIMK(passwd)
{
	return getIMKorILK(passwd, true);
}
async function getILK(passwd)
{
	return getIMKorILK(passwd, false);
}
async function getIMKorILK(passwd, isIMK)
{
	if (isIMK && !hasIMK())
		throw new Error('ERRGI000', "Missing IMK");
	if (!isIMK && !hasILK())
		throw new Error('ERRGI001', "Missing ILK");
	if (passwd == null && passwordEnscrypted == null)
		throw new Error('ERRGI007', "Missing password");
	if (passwordEnscrypted == null)
	{
		if (passwordEnscryptSalt == null)
			throw new Error('ERRGI004', "Missing passwordEnscryptSalt");
		if (passwordEnscryptLogN == null)
			throw new Error('ERRGI005', "Missing passwordEnscryptLogN");
		if (passwordEnscryptIter == null)
			throw new Error('ERRGI006', "Missing passwordEnscryptIter");
		passwordEnscrypted = await enscrypt(localSodium.crypto_pwhash_scryptsalsa208sha256_ll, passwd, passwordEnscryptSalt, passwordEnscryptLogN, passwordEnscryptIter, (step, max) => {});
	}
	if (passwordEnscrypted.length !== 32)
	{
		memzero(passwordEnscrypted);
		passwordEnscrypted = null;
		console.warn("background.getIMKorILK", "ERRGI002", "Length of passwordEnscrypted should be 32");
		throw new Error('ERRGI002', "Length of passwordEnscrypted should be 32");
	}

	try
	{
		let decrypted = await aesGcmDecrypt(isIMK ? IMK : ILK, null, passwordEnscrypted, passIv);
		if (!savepwd)
		{
			memzero(passwordEnscrypted);
			passwordEnscrypted = null;
		}
		return decrypted;
	}
	catch (err)
	{
		memzero(passwordEnscrypted);
		passwordEnscrypted = null;
		console.warn("background.getIMKorILK", "ERRGI003");
		throw new Error('ERRGI003', "Wrong password");
	}
}
async function setIMLK(newIMK, newILK, newPasswordAB)
{
	if (newIMK.constructor !== Uint8Array || newIMK.length !== 32)
		throw new Error('ERRSI000', 'Argument 1 "newIMK" should be a Uint8Array of length 32');
	if (newILK.constructor !== Uint8Array || newILK.length !== 32)
		throw new Error('ERRSI001', 'Argument 2 "newILK" should be a Uint8Array of length 32');
	if (newPasswordAB.constructor !== Uint8Array)
		throw new Error("ERRSI002", 'Argument 3 "newPasswordAB" should be a Uint8Array');
	let newPasswordEnscryptSalt = localSodium.randombytes_buf(16);
	let enscryptedNewPassword = await enscrypt(localSodium.crypto_pwhash_scryptsalsa208sha256_ll, newPasswordAB, newPasswordEnscryptSalt, passwordEnscryptLogN, passwordEnscryptIter, (step, max) => {});
	memzero(newPasswordAB);
	if (enscryptedNewPassword.length !== 32)
		throw new Error("ERRSI003", "Length of enscryptedNewPassword should be 32");
	let newPassIv = localSodium.randombytes_buf(12); //FIXME: or we could use crypto.getRandomValues(new Uint8Array(12)), which is better?
	let newEncrptdIMK = await aesGcmEncrypt(newIMK, null, enscryptedNewPassword, newPassIv);
	memzero(newIMK);
	let newEncrptdILK = await aesGcmEncrypt(newILK, null, enscryptedNewPassword, newPassIv);
	memzero(newILK);
	if (savepwd)
		passwordEnscrypted = enscryptedNewPassword;
	else
		memzero(enscryptedNewPassword);
	IMK = newEncrptdIMK;
	ILK = newEncrptdILK;
	passIv = newPassIv;
	passwordEnscryptSalt = newPasswordEnscryptSalt;
	chrome.storage.local.set({"encrIMK": Array.from(newEncrptdIMK), "encrILK": Array.from(newEncrptdILK), "passIv": Array.from(newPassIv), "passwordEnscryptSalt": Array.from(newPasswordEnscryptSalt)}, () => {
		if (chrome.runtime.lastError)
			console.warn("chrome.storage.local.set", chrome.runtime.lastError);
	});
	return { success: true };
}
function hasPassword()
{
	return passwordEnscrypted != null;
}

async function doServerRequest(linkUrl, server, windowLocUrl, passwdFromPopupAB, tabId, isNewIdentity, sendResponseToContent) //FIXME: remove isNewIdentity and sendResponseToContent???
{
/*
	if (typeof href != "string" || !href.startsWith("sqrl://"))
		throw new Error('ERRPD001', 'Argument 1 "href" should be a string starting with "sqrl://"');
	if (typeof windowLoc != "string" || !/^https?:\/\//.test(windowLoc))
		throw new Error('ERRPD002', 'Argument 2 "windowLoc" should be a string starting with "http://" or "https://"');
	let linkUrl = new URL(href.replace(/^sqrl:/, 'https:'));
	let windowLocUrl = new URL(windowLoc);
	if (linkUrl.origin !== windowLocUrl.origin)
		throw new Error('ERRPD008', 'Cross-Origin Authentication attempt');
*/
	if (linkUrl == null)
		throw new Error('ERRPD001', 'Argument 1 "linkUrl" should not be null');
	if (!(linkUrl instanceof URL))
		throw new Error('ERRPD002', 'Argument 1 "linkUrl" should contain a valid URL');
	if (!isValidHostname(linkUrl.hostname))
		throw new Error('ERRPD003', 'Argument 1 "linkUrl" should contain a valid hostname in the URL');
	if (typeof server != "string" || !couldBeBase64urlEncoded(server))
		throw new Error('ERRPD004', 'Argument 2 "server" should be a string with base64url characters');
	if (windowLocUrl == null)
		throw new Error('ERRPD005', 'Argument 3 "windowLocUrl" should not be null');
	if (!(windowLocUrl instanceof URL))
		throw new Error('ERRPD006', 'Argument 3 "windowLocUrl" should contain a valid URL');
	if (!isValidHostname(windowLocUrl.hostname))
		throw new Error('ERRPD007', 'Argument 3 "windowLocUrl" should contain a valid hostname in the URL');
	if (passwdFromPopupAB != null && passwdFromPopupAB.constructor !== Uint8Array)
		throw new Error('ERRPD008', 'Argument 4 "passwdFromPopup" should be a Uint8Array or null');


	if (!hasIMK())
		throw new Error('ERRPD009', 'Missing identity');
	if (!hasPassword() && passwdFromPopupAB == null)
		throw new Error('ERRPD010', 'Missing password');

	await sodiumPromise;
	let currIMK = await getIMK(passwdFromPopupAB);
	delete getPostDataQueue[tabId];
	let hostnameExtended = linkUrl.hostname;
	if (linkUrl.search.length > 1)//starts with '?'
	{
		let searchParams = new URLSearchParams(linkUrl.search.substr(1));
		if (searchParams.has("x") && /^[1-9]\d*$/.test(searchParams.get("x")))
		{
			let x = parseInt(searchParams.get("x"), 10);
			hostnameExtended = linkUrl.hostname + linkUrl.pathname.substr(0,x);
		}
	}
	let HMAC256Hash = localSodium.crypto_auth_hmacsha256(hostnameExtended, currIMK);
	memzero(currIMK);

	let { publicKey: SitePublicKey, privateKey: SitePrivateKey } = localSodium.crypto_sign_seed_keypair(HMAC256Hash);
	memzero(HMAC256Hash);

	let clientData = [
		"cmd=query",
		"ver=1",
		"idk=" + localSodium.to_base64(SitePublicKey),
		"opt=cps" //"opt=suk"
		//FIXME: add "ins" when server requests it via sin=i
	];
	clientData.push(""); //keep this empty string for trailing \r\n
	let client = base64url_encode(clientData.join("\r\n"));
	memzero(SitePublicKey);

	let ids = localSodium.crypto_sign_detached(client + server, SitePrivateKey, 'base64');
	//memzero(SitePrivateKey);
//console.log("doServerRequest", "client", clientData);
//console.log("doServerRequest", "server", server);
//console.log("doServerRequest", "ids", ids);


// STEP 1: do q cmd=query
//console.log("fetch", linkUrl.href, ["client=" + encodeURIComponent(client), "server=" + encodeURIComponent(server), "ids=" + encodeURIComponent(ids)].join('&'));
	let resp1 = await fetch(linkUrl.href, {
		"body": ["client=" + encodeURIComponent(client), "server=" + encodeURIComponent(server), "ids=" + encodeURIComponent(ids)].join('&'),
		"cache": "no-cache", // *default, no-cache, reload, force-cache, only-if-cached
		"method": "POST", // *GET, PUT, DELETE, etc.
		"headers": { "content-type": "application/x-www-form-urlencoded" },
		"referer": "no-referrer", // *client, no-referrer
		"redirect": "error", // *manual, follow, error
		"credentials": "omit", // include, *omit, same-origin
	}).catch(err => {
		memzero(SitePrivateKey);
		throw new Error("ERRFE000", "Response not defined");
	});
	if (resp1 && resp1.ok) //statusCode == 200
	{
		let responseText1 = await resp1.text();
		let responseMap1 = getResponseAsMap(responseText1);
		if ("tif" in responseMap1)
		{
			if ("qry" in responseMap1)
			{
				clientData[0] = "cmd=ident";
				clientData.pop(); //remove empty string previously pushed
				if (!bitIsSet(Number.parseInt(responseMap1.tif, 16), ID_MATCH))
				{
					let currILK = await getILK(passwdFromPopupAB);
					let [SUK, VUK] = getSukVuk(currILK);
					memzero(currILK);//getSukVuk also memzeros currILK
					clientData.push("suk=" + localSodium.to_base64(SUK));
					clientData.push("vuk=" + localSodium.to_base64(VUK));
					memzero(SUK);
					memzero(VUK);
				}
				clientData.push(""); //keep this empty string for trailing \r\n
				let client = base64url_encode(clientData.join("\r\n"));

				ids = localSodium.crypto_sign_detached(client + responseText1, SitePrivateKey, 'base64');
				memzero(SitePrivateKey);
				let resp2 = await fetch(linkUrl.origin + responseMap1.qry, {
					"body": ["client=" + encodeURIComponent(client), "server=" + encodeURIComponent(responseText1), "ids=" + encodeURIComponent(ids)].join('&'),
					"cache": "no-cache", // *default, no-cache, reload, force-cache, only-if-cached
					"method": "POST", // *GET, PUT, DELETE, etc.
					"headers": { "content-type": "application/x-www-form-urlencoded" },
					"referer": "no-referrer", // *client, no-referrer
					"redirect": "error", // *manual, follow, error
					"credentials": "omit", // include, *omit, same-origin
				}).catch(err => {
					throw new Error("ERRFE001", "Response2 not defined");
				});
				if (resp2 && resp2.ok) //statusCode == 200
				{
					let responseText2 = await resp2.text();
					let responseMap2 = getResponseAsMap(responseText2);
					if ("tif" in responseMap2)
					{
						//0x01	(Current) ID match: When set, this bit indicates that the web server has found an identity association for the user based upon the default (current) identity credentials supplied by the client: the IDentity Key (idk) and the IDentity Signature (ids).
						if ("url" in responseMap2)
						{
							return {"success": true, "url": responseMap2.url};
						}
						else if (!bitIsSet(Number.parseInt(responseMap2.tif, 16), ID_MATCH))
						{
							throw new Error("ERRFE003", "No IDMATCH in responseMap2");
						}
						else
						{
							throw new Error("ERRFE002", "No url in responseMap2");
						}
					}
					else
					{
						throw new Error("ERRFE004", "No tif in responseMap2");
					}
				}
				else
				{
					throw new Error("ERRFE005", "Response2 statuscode other than 200");
				}
			}
			else
			{
				memzero(SitePrivateKey);
				throw new Error("ERRFE006", "No qry in responseMap1");
			}
		}
		else
		{
			memzero(SitePrivateKey);
			throw new Error("ERRFE007", "No tif in responseMap1");
		}
	}
	else
	{
		memzero(SitePrivateKey);
		throw new Error("ERRFE008", "Response1 statuscode other than 200");
	}
}

function getResponseAsMap(responseText)
{
	let responseLines = base64url_decode(responseText).split("\r\n");
//console.log("getResponseAsMap", "server response", JSON.stringify(responseLines));
	let responseMap = {};
	for (let line of responseLines)
	{
		let eqPos = line.indexOf("=");
		if (eqPos > -1)
			responseMap[line.substring(0,eqPos)] = line.substr(eqPos + 1);
	}
	return responseMap;
}



function getSukVuk(ILK)//ILK IS MEMZERO'D by this function
{
	let randomLock = localSodium.randombytes_buf(32);
	let SUK = localSodium.crypto_scalarmult_base(randomLock);
	let bytesToSign = localSodium.crypto_scalarmult(randomLock, ILK);
//console.log("getSukVuk", "randomLock", ab2hex(randomLock));
	memzero(randomLock);
	memzero(ILK);
	let vukKeypair = localSodium.crypto_sign_seed_keypair(bytesToSign);
	let VUK = vukKeypair.publicKey; //ignore privateKey
	memzero(vukKeypair.privateKey);
/*
	let VUK64 = localSodium.crypto_sign_seed_keypair(bytesToSign).privateKey; //ignore publicKey
	memzero(bytesToSign);
	let VUK = VUK64.slice(0,32);
	memzero(VUK64);
*/
	return [SUK, VUK];
}

async function createIdentity()
{
	let newIUK = localSodium.randombytes_buf(32);
	let enscryptSalt = localSodium.randombytes_buf(16);
	let enscryptIter = 120;//Don't go over 255, see fixme below
	let enscryptLogN = 9;
	let newRescueCode = [];
	let additionalData = new Uint8Array(25);
	additionalData.set([73, 0, 2, 0], 0);
	additionalData.set(enscryptSalt, 4);
	additionalData.set([enscryptLogN, enscryptIter, 0, 0, 0], 20);//FIXME: only works when enscryptIter < 256
	for (let i = 0; i < 6; i++)
	{
		newRescueCode.push(zeropad(localSodium.randombytes_uniform(10000), 4));
	}
	let enscryptedNewRescueCode = await enscrypt(localSodium.crypto_pwhash_scryptsalsa208sha256_ll, str2ab(newRescueCode.join("")), enscryptSalt, enscryptLogN, enscryptIter, (step, max) => {
		chrome.runtime.sendMessage({'action': 'createIdentity.enscryptUpdate', "step": step, "max": max});
	});
	if (enscryptedNewRescueCode.length !== 32)
		throw new Error("ERRCI002", "Length of enscryptedNewRescueCode should be 32");
	let dataToDecrypt = await aesGcmEncrypt(newIUK, additionalData, enscryptedNewRescueCode, new Uint8Array(12));
//console.log("createIdentity", "IUK", ab2hex(newIUK));
	memzero(newIUK);
	let newTextualIdentity = await serializeBlock2(dataToDecrypt, additionalData);
	return {"textualIdentity": newTextualIdentity, "rescueCode": newRescueCode.join("-"), "enscryptedRescueCode": JSON.stringify(Array.from(enscryptedNewRescueCode))};
}
function importIdentity(ti, rescueCode, enscryptedRescueCode, newPassword, sendResponse)
{
	if (rescueCode == null && enscryptedRescueCode == null)
	{
		console.warn("background.importIdentity", "ERRII006", "Missing rescueCode or enscryptedRescueCode");
		sendResponse({"success": false, "errorCode": "ERRII006"});
	}
	else
	{
		validateTextualIdentity(ti).then(validationResult => { //will also return success == true if the textual identity is only partly entered!
			if (validationResult.success)
			{
				try
				{
					let extractedBlock2 = parseBlockType2(ti);
					textualIdentity = ti;
					chrome.storage.local.set({"textualIdentity": ti}, () => {
						if (chrome.runtime.lastError)
							console.warn("chrome.storage.local.set", "textualIdentity", chrome.runtime.lastError);
					});
					//console.log("rescueCode", JSON.stringify(Array.from(rescueCode)), rescueCode.length);
					let prms = enscryptedRescueCode == null ? enscrypt(localSodium.crypto_pwhash_scryptsalsa208sha256_ll, str2ab(rescueCode.replace(/[^0-9]/g, "")), extractedBlock2.enscryptSalt, extractedBlock2.enscryptLogN, extractedBlock2.enscryptIter, (step, max) => {
						chrome.runtime.sendMessage({'action': 'importIdentity.enscryptUpdate', "step": step, "max": max}, result => {/* do nothing */});
					}) : new Promise(resolve => resolve(enscryptedRescueCode));
					prms.then(enscryptedRescueCodeLocal => {
						//console.log("enscryptedRescueCodeLocal", JSON.stringify(Array.from(enscryptedRescueCodeLocal)));
						aesGcmDecrypt(extractedBlock2.dataToDecrypt, extractedBlock2.additionalData, enscryptedRescueCodeLocal, new Uint8Array(12)).then(IUK => {
							let newIMK = enhash(IUK);
							let newILK = localSodium.crypto_scalarmult_base(IUK);
//console.log("importIdentity", "IUK", ab2hex(IUK));
//console.log("importIdentity", "IMK", ab2hex(newIMK));
//console.log("importIdentity", "ILK", ab2hex(newILK));
							memzero(IUK);
							let newPasswordAB = str2ab(newPassword);//FIXME: dont allow empty password
							setIMLK(newIMK, newILK, newPasswordAB).then(result => {
								memzero(newIMK);
								memzero(newILK);
								//do not memzero newPasswordAB
								if (result && result.success)
								{
									sendResponse({"success": true});
								}
								else
								{
									console.warn("background.importIdentity", "ERRII007", "setIMLK failed");
									sendResponse({"success": false, "errorCode": "ERRII007"});
								}
							}).catch(err => {
								memzero(newIMK);
								memzero(newILK);
								//do not memzero newPasswordAB
								console.warn("background.importIdentity", "ERRII005", "setIMLK threw error", err);
								sendResponse({"success": false, "errorCode": "ERRII005"});
							});
						}).catch(err => {
							console.warn("background.importIdentity", "ERRII004", "aesGcmDecrypt IUK failed");
							sendResponse({"success": false, "errorCode": "ERRII004"});
						});
					}).catch(err => {
						console.warn("background.importIdentity", "ERRII003", "enscrypting rescueCode failed");
						sendResponse({"success": false, "errorCode": "ERRII003"});
					});
				}
				catch(err)
				{
					console.warn("background.importIdentity", "ERRII002");
					sendResponse({"success": false, "errorCode": "ERRII002"});
				}
			}
			else
			{
				console.warn("background.importIdentity", "ERRII001", "Invalid textualIdentity");
				sendResponse({"success": false, "errorCode": "ERRII001"});
			}
		}).catch(err => {
			console.warn("background.importIdentity", "ERRII000", "Validating textualIdentity failed");
			sendResponse({"success": false, "errorCode": "ERRII000"});
		});
	}
}





/*** Former content.js ajax code ***/
const ID_MATCH = 1, PREV_ID_MATCH = 2, IP_MATCH = 4, SQRL_DISABLED = 8, UNSUPPORTED_FUNCTION = 16, TRANSIENT_ERROR = 32, COMMAND_FAILED = 64, CLIENT_FAILURE = 128, BAD_ID = 256;
const b64uRE = /^[ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789\-_]+\=*$/;
function couldBeBase64urlEncoded(data)
{
	return b64uRE.test(data);
}
function base64url_decode(data)
{
	if (data.length % 4 > 0)
	{
		//pad with equal signs
		data = data + new Array(5 - (data.length % 4)).join("=");
	}
	let dst = "";

	let b64u = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";   // base64url dictionary
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

function bitIsSet(n, mask)
{
	if (typeof n != "number")
		throw "First argument 'n' must be a number";
	return n & mask === mask;
}

function addRequestToPostDataQueue(href, prevServerResp, windowLoc, isNewIdentity, tabId, sendResponseToContent)
{
	if (typeof href != "string" || !href.startsWith("sqrl://"))
		throw new Error('ERRAR001', 'Argument "href" should be a string starting with "sqrl://"');
	else if (typeof windowLoc != "string" || !/^https?:\/\//.test(windowLoc))
		throw new Error('ERRAR002', 'Argument "windowLoc" should be a string starting with "http://" or "https://"');
	else if (typeof prevServerResp != "string" || !couldBeBase64urlEncoded(prevServerResp))
		throw new Error('ERRAR009', 'Argument "prevServerResp" should be a string with base64url characters');
	else
	{
		let linkUrl = new URL(href.replace(/^sqrl:/, 'https:'));
		if (linkUrl == null)
			throw new Error('ERRAR003', 'Argument "href" should contain a valid URL');
		else if (!isValidHostname(linkUrl.hostname))
			throw new Error('ERRAR004', 'Argument "href" should contain a valid hostname in the URL');
		else
		{
			let windowLocUrl = new URL(windowLoc);
			if (windowLocUrl == null)
				throw new Error('ERRAR005', 'Argument "windowLoc" should contain a valid URL');
			else if (!isValidHostname(windowLocUrl.hostname))
				throw new Error('ERRAR005', 'Argument "windowLoc" should contain a valid hostname in the URL');
/*
			else if (linkUrl.origin !== windowLocUrl.origin)
			{
				showBadgeError("COA", 0, tabId);
				throw new Error('ERRAR007', 'Cross-Origin Authentication attempt');
			}
*/
			else if (!hasIMK())
			{
				showBadgeError("IDTY", 6, tabId);
				throw new Error("ERRAR008", "Missing identity");
			}
			else //success
			{
				getPostDataQueue["" + tabId] = {"linkUrl": linkUrl, "prevServerResp": prevServerResp, "windowLocUrl": windowLocUrl, "isNewIdentity": isNewIdentity, "sendResponseToContent": sendResponseToContent};
				showBadgeError("Auth", 6, tabId);
				return true;
			}
		}
	}
}


/*** end ***/

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
//console.log("background onMessage", "savepwd", savepwd, "passwordEnscrypted", passwordEnscrypted);
	/* from content.js */
	if (request.action === "onAnchorClick")
	{
		if (sender != null && "tab" in sender && sender.tab.id != null)
		{
			try {
				let isAsync = addRequestToPostDataQueue(request.href, base64url_encode(request.href), request.windowLoc, false, sender.tab.id, sendResponse);
				if (isAsync)
				{
					return true;
				}
			} catch(e) {
				console.warn("background.requestAction", "ERRRA001", e.name, e.message, e.fileName);
				sendResponse({"success": false, "errorCode": e.message});
			}
		}
		else
		{
			console.warn("background.requestAction", "ERRRA002", "Tab not found in sender");
			sendResponse({"success": false, "errorCode": "ERRRA002"});
		}
	}
	/* from popup.js */
	//FIXME: find a way to make sure these requests are not coming from content.js but from popup.js
	else if (request.action === "sendPostDataToActiveTab")
	{
		chrome.tabs.query({'active': true, 'currentWindow': true}, tabsResp => {
			if (tabsResp != null && tabsResp.length)
			{
				let tabId = tabsResp[0].id;
				if (tabId in getPostDataQueue)
				{
					try {
						showBadgeError("", 0, tabId);
						let origRequest = getPostDataQueue[tabId];
						if (tabsResp[0].url === origRequest.windowLocUrl.href)
						{
							let passwdAB = request.password == null ? null : str2ab(request.password); //is memzero'd by getPostDataAsync
							//setSavepwd(request.savepwd);
							doServerRequest(origRequest.linkUrl, origRequest.prevServerResp, origRequest.windowLocUrl, passwdAB, tabId, origRequest.isNewIdentity, origRequest.sendResponseToContent).then(data => {
								if (data && data.success)
								{
									origRequest.sendResponseToContent({"success": true, "url": data.url}); //to content
									sendResponse({"success": true, "hasOpenRequest": true}); // to popup
								}
								else
								{
									console.warn("background.requestAction", "ERRRA003");//, err.message, err.fileName);
									origRequest.sendResponseToContent({"success": false, "errorCode": "ERRRA003"}); //to content
									sendResponse({"success": false, "errorCode": "ERRRA003"}); // to popup
								}
							}).catch(err => {
								console.warn("background.requestAction", "ERRRA004", err.message, err.fileName);//FIXME; remove err info
								if (err.message == "ERRPD010")		{ showBadgeError("PASS", 6, tabId); }
								else if (err.message == "ERRPD009")	{ showBadgeError("IDTY", 6, tabId); }
								//else if (err.message == "ERRPD008")	{ showBadgeError("COA", 0, tabId); }
								else if (err.message == "ERRGI003")	{ sendResponse({"success": false, "errorCode": err.message}); } //to popup, wrong password
								else
								{
									origRequest.sendResponseToContent({"success": false, "errorCode": err.message}); //to content
									sendResponse({"success": false, "errorCode": err.message}); // to popup
								}
							});
						}
						else
						{
							delete getPostDataQueue[tabId];
							//console.log("background.requestAction", "ERRRA003", "tab's location url has changed");
							sendResponse({"success": true, "hasOpenRequest": false});
						}
					} catch (err) {
						console.warn("background.requestAction", "ERRRA005", err.message);//FIXME: remove message
						sendResponse({"success": false, "errorCode": "ERRRA005"});
					}
				}
				else
				{
					sendResponse({"success": true, "hasOpenRequest": false});
				}
			}
			else
			{
				sendResponse({"success": true, "hasOpenRequest": false});
			}
		});
		return true;
	}
	else if (request.action === "hasPendingRequest")
	{
		chrome.tabs.query({'active': true, 'currentWindow': true}, tabsResp => {
			if (chrome.runtime.lastError)
			{
				console.warn("background.requestAction", "ERRRA006");
				sendResponse({"success": false, "hasPendingRequest": false, "errorCode": "ERRRA006"});
			}
			else if (tabsResp != null && tabsResp.length)
			{
				let tabId = tabsResp[0].id;
				if (tabId in getPostDataQueue)
				{
					let origRequest = getPostDataQueue[tabId];
					let isSameOrigin = origRequest.linkUrl.origin === origRequest.windowLocUrl.origin;
					sendResponse({"success": true, "hasPendingRequest": true, "hasPassword": hasPassword(), "isSameOrigin": isSameOrigin, "linkOrigin": origRequest.linkUrl.origin});
				}
				else
					sendResponse({"success": true, "hasPendingRequest": false, "hasPassword": hasPassword()});
			}
		});
		return true;
	}
/*
	else if (request.action === "hasPassword")
	{
		sendResponse({"hasPassword": hasPassword()});
	}
*/
	else if (request.action === "savePassword")
	{
		setSavepwd(request.savepwd);
		sendResponse({"isSavepwd": savepwd});
	}
	else if (request.action === "isSavepwd")
	{
		sendResponse({"isSavepwd": savepwd});
	}
	else if (request.action === "hasIdentity")
	{
		if (hasIMK())
			sendResponse({"hasIdentity": true, "isSavepwd": savepwd, "hasPassword": hasPassword(), "textualIdentity": textualIdentity});
		else
			sendResponse({"hasIdentity": false, "isSavepwd": false, "hasPassword": hasPassword(), "partialTextualIdentity": partialTextualIdentity});
	}
	else if (request.action === "eraseIdentity")
	{
		if (IMK != null)
			memzero(IMK);
		if (ILK != null)
			memzero(ILK);
		if (passwordEnscrypted != null)
			memzero(passwordEnscrypted);
		IMK = null;
		ILK = null;
		passwordEnscrypted = null;
		passIv = null;
		passwordEnscryptSalt = null;
		textualIdentity = null;
		chrome.storage.local.remove(["encrIMK", "encrILK", "textualIdentity", "passwordEnscryptSalt", "passIv"], () => {
			if (chrome.runtime.lastError)
				console.warn("chrome.storage.local.remove", chrome.runtime.lastError);
			sendResponse(chrome.runtime.lastError);
		});
		return true;
	}
	else if (request.action === "createIdentity")
	{
		createIdentity().then(result => {
			sendResponse({"success": true, "textualIdentity": result.textualIdentity, "rescueCode": result.rescueCode, "enscryptedRescueCode": result.enscryptedRescueCode});
		}).catch(err => {
			sendResponse({"success": false, "errorCode": err.message});
		});
		return true;
	}
	else if (request.action === "openImportIdentityTab")
	{
		chrome.tabs.create({ url: "/importIdentity.html" }, tab => { importIdentityTabId = tab.id; });
	}
	else if (request.action === "importIdentity")
	{
		let enscryptedRescueCodeLocal = null;
		if ("enscryptedRescueCode" in request)
		{
			enscryptedRescueCodeLocal = new Uint8Array(request.enscryptedRescueCode);
			memzero(request.enscryptedRescueCode);
		}
		if (request.print)
		{
			chrome.tabs.create({ url: "/printIdentity.html" }, tab => {
//console.log("sending message to printIdentity", tab.id, new Date().getTime());
				setTimeout(() =>
					chrome.tabs.sendMessage(tab.id, {"action": "printIdentity", "textualIdentity": request.textualIdentity, "rescueCode": request.rescueCode})
				, 100);//For Chrome, doesn't immediately start listening for some reason
			});
		}
		importIdentity(request.textualIdentity, request.rescueCode, enscryptedRescueCodeLocal, request.password, sendResponse);
		partialTextualIdentity = null;
		return true;
	}
	else if (request.action === "importPartialIdentity") //from importIdentity.html tab
	{
		partialTextualIdentity = request.textualIdentity;
		sendResponse({"success": true});
		chrome.tabs.remove(importIdentityTabId);
	}
	else
		console.warn("background", "request action not recognised", request.action);
});
















//------------------------------- Utils -------------------------------//
function showBadgeError(txt, animateCount, tabId)//animateCount must be even
{
	chrome.browserAction.setBadgeBackgroundColor({color: "red"});
	if (chrome.browserAction.setBadgeTextColor)
		chrome.browserAction.setBadgeTextColor({color: "white"});
	chrome.browserAction.setBadgeText({"text": animateCount % 2 ? "" : txt, "tabId": tabId});
	if (animateCount > 0)
	{
		setTimeout(function(){ showBadgeError(txt, animateCount - 1, tabId); }, 300);
	}
}
function zeropad(nmbr, len)
{
	if (typeof nmbr == "number")
		nmbr = "" + nmbr;
	if (typeof nmbr != "string")
		throw new Error('Arument 1 "nmbr" should be a string or a number');
	if (typeof len != "number")
		throw new Error('Arument 2 "len" should be a number');
	if (len < 0)
		throw new Error('Arument 2 "len" should be positive');
	if (len < nmbr.length)
		throw new Error('Arument 2 "len" should be greater than the length of argument 1 "nmbr"');
	return new Array(len + 1 - nmbr.length).join("0") + nmbr;
}
function memzero(e)
{
	if (e.constructor === Uint8Array)
		for (let i = 0; i < e.length; i++)
			e[i] = 0;
	else if (e.constructor === BN)
		for (let i = 0; i < e.words.length; i++)
			e.words[i] = 0;
	else if (Array.isArray(e)) //TODO: check that setting the values to null is better than setting them to 0
		for (let i = 0; i < e.length; i++)
			e[i] = 0;
	else
		throw new Error("Only Uint8Array, Array and BN instances can be wiped");
}
/*
function str2ab(str) //WARNING: nameclash with the same method in utils.js //string to arraybuffer (Uint8Array)
{
	return new TextEncoder("utf-8").encode(str);
}
function ab2int(ab) //arraybuffer (Uint8Array) to int. Only works up to Number.MAX_SAFE_INTEGER or ab.length == 6
{
	if (ab.constructor !== Uint8Array)
		throw new Error("First argument \"ab\" should be a Uint8Array");
	if (ab.length > 6)
		throw new Error("Max length of Uint8Array is 6");
	let result = 0;
	let fact = 1;
	for (let i of ab)
	{
		result += fact * i;
		fact *= 256;
	}
	fact = 0; //cleanup
	return result;
}
*/
//FIXME: REMOVE THIS UNUSED FUNCTION?
function ab2hex(ab) //arraybuffer (Uint8Array) to hex
{
	let ui8a = null;
	if (ab.constructor === ArrayBuffer)
		ui8a = new Uint8Array(ab);
	else if (ab.constructor === Uint8Array)
		ui8a = ab;
	else
		throw new Error("First argument \"ab\" should be an Uint8Array or an ArrayBuffer");
	let result = [];
	for (let i of ui8a)
	{
		result.push(('00'+i.toString(16)).slice(-2));
	}
	if (ab.constructor === ArrayBuffer)
		memzero(ui8a);
	return result.join('');
}
function ar2hex(ar) //array of integers to hex
{
	return ar.map(i => ('00'+i.toString(16)).slice(-2)).join('');
}
function ui8aXOR(a, b) //beware: result is written back into a
{
	for (let i = 0; i < a.length; i++)
	{
		a[i] = a[i] ^ b[i];
	}
}
async function sleep(ms)
{
	return new Promise(resolve => setTimeout(resolve, ms));
}

//uses https://github.com/tonyg/js-scrypt/ or sodium
async function enscrypt(scrypt, pwd, salt, logN, iterations, callback)
{
//console.log("enscrypt", pwd, salt, logN, iterations);
	if (typeof callback != "function")
		callback = function(){};
	let N = Math.pow(2, logN);
	let result = scrypt(pwd, salt, N, 256, 1, 32);
	let xorresult = new Uint8Array(result);
	for (let i = 1; i < iterations; i++)
	{
		callback(i, iterations);
		await sleep(1); //sleep 1ms to allow UI update
		result = scrypt(pwd, result, N, 256, 1, 32);
		ui8aXOR(xorresult, result);//result of XOR is written back into xorresult
	}
	memzero(result);
	callback(iterations, iterations);
	return xorresult;
}
function enhash(input)
{
	if (input.constructor === Uint8Array && input.length === 32)
	{
		let output = new Uint8Array(32);
		for (let i = 0; i < 16; i++)
		{
			input = localSodium.crypto_hash_sha256(input);
			ui8aXOR(output, input);//result of XOR is written back into output
		}
		memzero(input);
		return output;
	}
	else
		throw new Error('Argument 1 "input" should be a Uint8Array of length 32');
}

async function aesGcmEncrypt(data, additionalData, password, iv)
{
	return aesGcmCrypt(true, data, additionalData, password, iv);
}
async function aesGcmDecrypt(data, additionalData, password, iv)
{
	return aesGcmCrypt(false, data, additionalData, password, iv);
}
async function aesGcmCrypt(isEncrypt, data, additionalData, password, iv)
{
	if (data.constructor === Uint8Array && data.length > 0)
	{
		if (additionalData == null || (additionalData.constructor === Uint8Array && additionalData.length > 0))
		{
			if (password.constructor === Uint8Array && password.length === 32)
			{
				if (iv.constructor === Uint8Array && iv.length === 12)
				{
					let cData = { "name": "AES-GCM", "iv": iv };//, "tagLength": 128 };
					if (additionalData != null)
					{
						cData.additionalData = additionalData;
					}
					if (isEncrypt)
					{
						return crypto.subtle.importKey("raw", password, { "name": "AES-GCM", length: 256 }, false, ["encrypt"]).then(key => crypto.subtle.encrypt(cData, key, data)).then(encr => new Uint8Array(encr));
					}
					else
					{
						return crypto.subtle.importKey("raw", password, { "name": "AES-GCM", length: 256 }, false, ["decrypt"]).then(key => crypto.subtle.decrypt(cData, key, data)).then(decr => new Uint8Array(decr));
					}
				}
				else
					return Promise.reject('Argument 4 "iv" should be a Uint8Array of length 12');
			}
			else
				return Promise.reject('Argument 3 "password" should be a Uint8Array of length 32');
		}
		else
			return Promise.reject('Argument 2 "additionalData" should be a non-empty Uint8Array or null');
	}
	else
		return Promise.reject('Argument 1 "data" should be a non-empty Uint8Array');
}

/*
async function validateTextualIdentity(ti)
{
	let lines = ti.split(/\r?\n/);
	let base56invalidsCharsRe = new RegExp(`([^${base56chars}])`);
	for (let [lIndex, line] of lines.entries())
	{
		let blocks = line.split(/ /);
		if (blocks.length < 5 && lIndex < lines.length - 1)
			return { "success": false, "lineNr": lIndex, "message": `Not enough blocks on line ${lIndex + 1}.\nA line must contain 5 blocks (of 4 characters), separated by spaces, unless it is the last line.` };
		if (blocks.length > 5)
			return { "success": false, "lineNr": lIndex, "message": `Too many blocks on line ${lIndex + 1}.\nA line can contain a maximum of 5 blocks (of 4 characters), separated by spaces.` };
		for (let [bIndex, block] of blocks.entries())
		{
			if (block.length < 4 && (bIndex < blocks.length - 1 || lIndex < lines.length - 1))
				return { "success": false, "lineNr": lIndex, "blockNr": bIndex, "message": `Not enough characters in block ${bIndex + 1} on line ${lIndex + 1}.\nA block must contain 4 characters unless it is the last block in the last line.` };
			if (block.length > 4)
				return { "success": false, "lineNr": lIndex, "blockNr": bIndex, "message": `Too many characters in block ${bIndex + 1} on line ${lIndex + 1}.\nA block can contain a maximum of 4 characters.` };
			let b56mismatch = block.match(base56invalidsCharsRe);
			if (b56mismatch)
				return { "success": false, "lineNr": lIndex, "blockNr": bIndex, "message": `Invalid character "${b56mismatch[1]}" on line ${lIndex + 1}.\nA block can only contain valid base56 characters.` };
		}
		//The final character on each line is a line checksum character formed by taking the (SHA256 mod 56) hashing of the line's previous characters plus the 0-based line number.
		if (line.length == 24 || (lIndex == 5 && line.length == 8) || (lIndex == 9 && line.length == 6)) //FIXME: add check for 2 or 3 prev identities
		{
			let lineChars = blocks.join("");
			let lastChar = lineChars.slice(-1);
			if (lastChar !== await getVerificationChar(lineChars, lIndex))
				return { "success": false, "lineNr": lIndex, "message": `Verification character mismatch on line ${lIndex + 1}.\nOne or more of the characters on this line is wrong.` };
		}
	}
	return { "success": true, "lineNr": lines.length };
}
*/
function parseBlockType2(ti)
{
	let identityData = parseTextualIdentity(ti);
	let blockSize = ab2int(identityData.slice(0, 2));
	let data = identityData.slice(0, blockSize);
	return {
		"enscryptSalt": data.slice(4, 20),
		"enscryptLogN": ab2int(data.slice(20, 21)),
		"enscryptIter": ab2int(data.slice(21, 25)),
		"dataToDecrypt": data.slice(25, 73),
		"additionalData": data.slice(0, 25)
	};
}
async function serializeBlock2(dataToDecrypt, additionalData)
{
	let data = new Uint8Array(73);
	if (dataToDecrypt.constructor === Uint8Array && dataToDecrypt.length === 48)
	{
		if (additionalData.constructor === Uint8Array && additionalData.length === 25)
		{
			data.set(additionalData, 0);
			data.set(dataToDecrypt, 25);
			data.reverse();
			let ti = base56encode(data);
			return addVerificationAndWhitespaceToTextualIdentity(ti);
		}
		else
			return Promise.reject('Argument 2 "additionalData" should be a Uint8Array of length 25');
	}
	else
		return Promise.reject('Argument 1 "dataToDecrypt" should be a Uint8Array of length 48');
}


function base64url_encode(str)
{
	return localSodium.to_base64(localSodium.from_string(str), localSodium.base64_variants.URLSAFE_NO_PADDING);
}
function isValidHostname(hn) // Must be punycode-encoded, like `new URL().hostname` is;
{
	/*
Hostnames are composed of series of labels concatenated with dots, as are all domain names.
For example, "en.wikipedia.org" is a hostname. Each label must be between 1 and 63 characters long, and the entire hostname has a maximum of 255 characters.
RFCs mandate that a hostname's labels may contain only the ASCII letters 'a' through 'z' (case-insensitive), the digits '0' through '9', and the hyphen. Hostname labels cannot begin or end with a hyphen. No other symbols, punctuation characters, or blank spaces are permitted.
	*/
	if (hn == null || typeof hn != "string" || hn.length == 0 || hn.length > 255 || !/^[a-zA-Z0-9\.\-]+$/.test(hn))
		return false;
	let splt = hn.split(".");
	for (let lbl of splt)
		if (lbl.length < 1 || lbl.length > 63 || lbl.startsWith('-') || lbl.endsWith('-'))
			return false;
	return true;
}
}

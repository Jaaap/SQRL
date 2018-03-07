{
"use strict";
let localSodium = null, textualIdentity = null, sodiumLoadQueue = [], getPostDataQueue = {};
window.sodium = { onload: sod => {
	localSodium = sod;
	for (func of sodiumLoadQueue)
	{
		func();
	}
	sodiumLoadQueue = [];
}};


let IMK = null;
function hasIMK()
{
	return IMK != null;
}
function getIMK()
{
	return IMK;
}
function setIMK(newIMK)
{
	if (newIMK instanceof Uint8Array && newIMK.length === 32)
	{
		IMK = newIMK;
		chrome.storage.local.set({"IMK": Array.from(newIMK)});
	}
	else
	{
		console.warn("background.setIMK", "ERRSI000", 'Argument 1 "newIMK" should be a Uint8Array of length 32');
		throw new Error('Argument 1 "newIMK" should be a Uint8Array of length 32');
	}
}
function eraseIMK()
{
	IMK = null;
	chrome.storage.local.remove(["IMK"], () => {});
}


function getPostDataAsync(href, windowLoc, sendResponse, tabId)
{
//console.log("backgroud.getPostDataAsync", href, windowLoc);
	if (typeof href == "string" && href.startsWith("sqrl://"))
	{
		let hurl = new URL(href.replace(/^sqrl:/, 'https:'));
		if (hurl != null && isValidHostname(hurl.hostname))
		{
			let wurl = new URL(windowLoc);
			if (wurl != null && isValidHostname(wurl.hostname))
			{
				if (hurl.origin === wurl.origin)
				{
					if (hasIMK())
					{
						showBadgeError("", 0, tabId);
						let work = (href, hurl) => {
							let HMAC256Hash = localSodium.crypto_auth_hmacsha256(hurl.hostname, getIMK());
/*
crypto.subtle.importKey("raw", getIMK(), {"name": "HMAC", "hash": "SHA-256"}, false, ["sign"]).then(key => crypto.subtle.sign({"name": "HMAC", "hash": "SHA-256"}, key, str2ab(hurl.hostname))).then(HMAC256Hash2 => {
	console.log(new Uint8Array(HMAC256Hash2));
});
*/

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

							sendResponse({"success": true, "href": href, "postData": ["client=" + encodeURIComponent(client), "server=" + encodeURIComponent(server), "ids=" + encodeURIComponent(ids)].join('&')});
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
					else
					{
						showBadgeError("IDTY", 6, tabId);
						console.warn("background.getPostDataAsync", "ERRPD005", "Missing identity");
						sendResponse({"success": false, "errorCode": "ERRPD005"});
						return true;
					}
				}
				else
				{
					showBadgeError("COA", 0, tabId);
					console.warn("background.getPostDataAsync", "ERRPD004", "Cross-Origin Authentication attempt");
					sendResponse({"success": false, "errorCode": "ERRPD004"});
					return true;
				}
			}
			else
			{
				console.warn("background.getPostDataAsync", "ERRPD003", "Invalid window location");
				sendResponse({"success": false, "errorCode": "ERRPD003"});
				return true;
			}
		}
		else
		{
			console.warn("background.getPostDataAsync", "ERRPD002", "Invalid link location");
			sendResponse({"success": false, "errorCode": "ERRPD002"});
			return true;
		}
	}
	else
	{
		console.warn("background.getPostDataAsync", "ERRPD001", "Invalid sqrl link");
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
		newRescueCode.push(zeropad(localSodium.randombytes_uniform(10000), 4));
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
					console.warn("background.createIdentity", "ERRCI004", "serializeBlock2 failed");
					sendResponse({"success": false, "errorCode": "ERRCI004"});
				});
			}
			catch (err)
			{
				console.warn("background.createIdentity", "ERRCI003", "serializeBlock2 failed");
				sendResponse({"success": false, "errorCode": "ERRCI003"});
			}
		}).catch(err => {
			console.warn("background.createIdentity", "ERRCI002", "aesGcmEncrypt failed");
			sendResponse({"success": false, "errorCode": "ERRCI002"});
		});
	}).catch(err => {
		console.warn("background.createIdentity", "ERRCI001", "enscrypt failed");
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
						setIMK(enhash(localSodium, IUK));
						memzero(IUK);
						sendResponse({"success": true, "name": ab2hex(localSodium.crypto_hash_sha256(getIMK())).substr(0,8)});
					}).catch(err => {
						console.warn("background.importIdentity", "ERRII004", "aesGcmDecrypt failed");
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

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
	/* for content.js */
	if (request.action === "getPostData")
	{
		if (sender != null && "tab" in sender && sender.tab.id != null)
		{
			if (hasIMK())
			{
				getPostDataQueue["" + sender.tab.id] = {"href": request.href, "windowLoc": request.windowLoc};
				showBadgeError("Auth", 6, sender.tab.id);
				sendResponse({"success": true});
			}
			else
			{
				showBadgeError("IDTY", 6, sender.tab.id);
				console.warn("background.requestAction", "ERRRA001", "Missing identity");
				sendResponse({"success": false, "errorCode": "ERRRA001"});
			}
/*
			let hasCalledSendresponse = getPostDataAsync(request.href, request.windowLoc, sendResponse, sender.tab.id);
			if (!hasCalledSendresponse)
				return true; // make asynchronous
*/
		}
		else
		{
			console.warn("background.requestAction", "ERRRA000", "Tab not found in sender");
			sendResponse({"success": false, "errorCode": "ERRRA000"});
		}
	}
	/* for popup.js */
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
						let request = getPostDataQueue[tabId];
						delete getPostDataQueue[tabId];
						//chrome.tabs.sendMessage(tabId, getPostDataAsync(request.href, request.windowLoc, tabId), data => {});
						if (tabsResp[0].url === request.windowLoc)
						{
							getPostDataAsync(request.href, request.windowLoc, data => {
								//console.log("background.requestAction", "getPostDataAsync.sendMessage", data);
								data.action = "getPostDataResp";
								chrome.tabs.sendMessage(tabId, data, resp => {
									//console.log("background.requestAction", "resp", resp);
								});
							}, tabId);
							sendResponse({"success": true, "hasOpenRequest": true});
						}
						else
						{
							//console.log("background.requestAction", "ERRRA003", "tab's location url has changed");
							sendResponse({"success": true, "hasOpenRequest": false});
						}
					} catch (err) {
						console.warn("background.requestAction", "ERRRA002");
						sendResponse({"success": false, "errorCode": "ERRRA002"});
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
	else if (request.action === "hasIdentity")
	{
		if (hasIMK())
		{
			crypto.subtle.digest('SHA-256', getIMK()).then(sha256result => {
				sendResponse({"hasIdentity": true, "name": ab2hex(sha256result).substr(0,8), "textualIdentity": textualIdentity});
			}).catch(err => {
				console.warn("background.hasIdentity", "ERRHI000");
				sendResponse({"success": false, "errorCode": "ERRHI000"});
			});
			return true;
		}
		else
		{
			sendResponse({"hasIdentity": false});
		}
	}
	else if (request.action === "eraseIdentity")
	{
		eraseIMK();
		chrome.storage.local.remove(["identityDataType2"], () => {
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
		setIMK(new Uint8Array(result.IMK));
		memzero(result.IMK);
		delete result.IMK;
	}
	if (result.textualIdentity)
	{
		textualIdentity = result.textualIdentity;
	}
});















//------------------------------- Utils -------------------------------//
function showBadgeError(txt, animateCount, tabId)//animateCount must be even
{
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
	if (e instanceof Uint8Array)
		for (let i = 0; i < e.length; i++)
			e[i] = 0;
	else if (e instanceof BN)
		for (let i = 0; i < e.words.length; i++)
			e.words[i] = 0;
	else if (Array.isArray(e)) //TODO: check that setting the values to null is better than setting them to 0
		for (let i = 0; i < e.length; i++)
			e[i] = null;
	else
		throw new Error("Only Uint8Array, Array and BN instances can be wiped");
}
function str2ab(str) //WARNING: nameclash with the same method in utils.js //string to arraybuffer (Uint8Array)
{
	return new TextEncoder("utf-8").encode(str);
}
function ab2int(ab) //arraybuffer (Uint8Array) to int. Only works up to Number.MAX_SAFE_INTEGER or ab.length == 6
{
	if (!(ab instanceof Uint8Array))
		throw new Error("First argument \"ab\" should be a  Uint8Array");
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
function ab2hex(ab) //arraybuffer (Uint8Array) to hex
{
	let ui8a = null;
	if (ab instanceof ArrayBuffer)
		ui8a = new Uint8Array(ab);
	else if (ab instanceof Uint8Array)
		ui8a = ab;
	else
		throw new Error("First argument \"ab\" should be an Uint8Array or an ArrayBuffer");
	let result = [];
	for (let i of ui8a)
	{
		result.push(('00'+i.toString(16)).slice(-2));
	}
	if (ab instanceof ArrayBuffer)
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
		a[i] =  a[i] ^ b[i];
	}
}
function sleep(ms)
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
function enhash(sodium, input)
{
	if (input.constructor === Uint8Array && input.length === 32)
	{
		let output = new Uint8Array(32);
		for (let i = 0; i < 16; i++)
		{
			input = sodium.crypto_hash_sha256(input);
			ui8aXOR(output, input);//result of XOR is written back into output
		}
		memzero(input);
		return output;
	}
	else
		throw new Error('Argument 1 "input" should be a Uint8Array of length 32');
}

function aesGcmEncrypt(data, additionalData, password, iv)
{
	return aesGcmCrypt(true, data, additionalData, password, iv);
}
function aesGcmDecrypt(data, additionalData, password, iv)
{
	return aesGcmCrypt(false, data, additionalData, password, iv);
}
function aesGcmCrypt(isEncrypt, data, additionalData, password, iv)
{
	if (data.constructor === Uint8Array && data.length > 0)
	{
		if (additionalData.constructor === Uint8Array && additionalData.length > 0)
		{
			if (password.constructor === Uint8Array && password.length === 32)
			{
				if (iv.constructor === Uint8Array && iv.length === 12)
				{
					if (isEncrypt)
					{
						return crypto.subtle.importKey("raw", password, { "name": "AES-GCM", length: 256 }, false, ["encrypt"]).then(key =>
							crypto.subtle.encrypt({ "name": "AES-GCM", "iv": iv, "additionalData": additionalData, "tagLength": 128 }, key, data)
						);
					}
					else
					{
						return crypto.subtle.importKey("raw", password, { "name": "AES-GCM", length: 256 }, false, ["decrypt"]).then(key =>
							crypto.subtle.decrypt({ "name": "AES-GCM", "iv": iv, "additionalData": additionalData, "tagLength": 128 }, key, data)
						);
					}
				}
				else
					throw new Error('Argument 4 "iv" should be a Uint8Array of length 12');
			}
			else
				throw new Error('Argument 3 "password" should be a Uint8Array of length 32');
		}
		else
			throw new Error('Argument 2 "additionalData" should be a non-empty Uint8Array');
	}
	else
		throw new Error('Argument 1 "data" should be a non-empty Uint8Array');
}

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
function parseBlockType2(ti)
{
	let identityData = base56decode(ti.replace(/[\t ]/g,'').replace(/.(\r?\n|$)/g, "")).toArrayLike(Uint8Array).reverse();
	if ([73, 127, 159, 191, 223].indexOf(identityData.length) > -1)
	{
		//console.log("identityData", JSON.stringify(Array.from(identityData)), identityData.length);
		let blockSize = ab2int(identityData.slice(0, 2));
		let blockType = ab2int(identityData.slice(2, 4));
		if (blockType == 2 && blockSize == 73)
		{
			let data = identityData.slice(0, blockSize);
			return {
				"enscryptSalt": data.slice(4, 20),
				"enscryptLogN": ab2int(data.slice(20, 21)),
				"enscryptIter": ab2int(data.slice(21, 25)),
				"dataToDecrypt": data.slice(25, 73),
				"additionalData": data.slice(0, 25)
			};
		}
		else
			throw new Error('Argument 1 "ti" should start with a type2 data block of length 73');
	}
	else
		throw new Error('base56decoded length of first argument "ti" should be 73, 127, 159, 191 or 223');
}
function serializeBlock2(dataToDecrypt, additionalData)
{
	let data = new Uint8Array(73);
	if (additionalData instanceof ArrayBuffer)
		additionalData = new Uint8Array(additionalData);
	if (dataToDecrypt instanceof ArrayBuffer)
		dataToDecrypt = new Uint8Array(dataToDecrypt);
	if (dataToDecrypt.constructor === Uint8Array && dataToDecrypt.length === 48)
	{
		if (additionalData.constructor === Uint8Array && additionalData.length === 25)
		{
			data.set(additionalData, 0);
			data.set(dataToDecrypt, 25);
			data.reverse();
			let ti = base56encode(data);
			let promises = [];
			for (let i = 0; 19 * i < ti.length; i++)
			{
				promises.push(getVerificationChar(ti.substr(19 * i, 19) + " ", i));
			}
			return Promise.all(promises).then(verificationChars => {
				let result = [];
				for (let i = 0; 19 * i < ti.length; i++)
				{
					result[i] = (ti.substr(19 * i, 19) + verificationChars[i]).replace(/(.{4})\B/g, "$1 ");
				}
				return result.join("\n");
			});
		}
		else
			throw new Error('Argument 2 "additionalData" should be a Uint8Array of length 25');
	}
	else
		throw new Error('Argument 1 "dataToDecrypt" should be a Uint8Array of length 48');
}


function base64url_encode(sodium, str)
{
	return sodium.to_base64(sodium.from_string(str), sodium.base64_variants.URLSAFE_NO_PADDING);
}
//uses BigNum, https://github.com/indutny/bn.js/
function base56encode(i)
{
	let bi;
	if (i instanceof BN)
		bi = i;
	else if (typeof i == "string" || i.constructor === Uint8Array)
		bi = new BN(i);
	else if (typeof i == "number")
	{
		if (i > Number.MAX_SAFE_INTEGER)
			throw new Error('base56encode: ERROR. Argument 1 "i" larger than ' + Number.MAX_SAFE_INTEGER + ' should be represented as String or BigInt');
		bi = new BN(i);
	}
	else
		throw new Error('base56encode: ERROR. Argument 1 "i" should be an integer represented as String, BigInt or Number');
	if (bi.isNeg())
		throw new Error('base56encode: ERROR. Argument 1 "i" should be positive');
	let result = [];
	do
	{
		let r = bi.modn(56);
		let q = bi.divn(56);
		result.push(base56chars[r]);
		bi = q;
	}
	while (bi.gtn(0));
	return result.join('');
}
function base56decode(s)
{
	if (typeof s != "string")
		throw new Error('base56decode: ERROR. Argument 1 "s" should be a String');
	if (/[^23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz]/.test(s))
		throw new Error('base56decode: ERROR. Argument 1 "s" can only contain valid base56 characters [23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz]');
	if (s == null || s == "")
		return 0;
	let result = new BN(0);
	for (let i = s.length-1; i >= 0; i--)
	{
		result.imuln(56);
		result.iaddn(base56chars.indexOf(s.charAt(i)));
	}
	return result;
}
function isValidHostname(hn) // Must be punycode-encoded, like `new URL().hostname` is;
{
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
}

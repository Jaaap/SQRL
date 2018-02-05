"use strict";
const base56chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';

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
function str2ab(str) //string to arraybuffer (Uint8Array)
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
	let result = [];
	for (let i of ab)
	{
		result.push(('00'+i.toString(16)).slice(-2));
	}
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

//uses https://github.com/tonyg/js-scrypt/raw/master/browser/scrypt.js
async function enscrypt(scrypt, pwd, salt, iterations, callback)
{
	let result = scrypt(pwd, salt, 512, 256, 1, 32);
	let xorresult = new Uint8Array(result);
	for (let i = 1; i < iterations; i++)
	{
		result = scrypt(pwd, result, 512, 256, 1, 32);
		ui8aXOR(xorresult, result);//result of XOR is written back into xorresult
		if (typeof callback == "function")
			callback(i, iterations - 1);
		await sleep(10); //sleep 10ms to allow UI update
	}
	memzero(result);
	return xorresult;
}
function enhash(input)
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

function aesGcmDecrypt(data, additionalData, password, iv)
{
	if (data.constructor === Uint8Array && data.length > 0)
	{
		if (additionalData.constructor === Uint8Array && additionalData.length > 0)
		{
			if (password.constructor === Uint8Array && password.length === 32)
			{
				if (iv.constructor === Uint8Array && iv.length === 12)
				{
					return crypto.subtle.importKey("raw", password, { "name": "AES-GCM", length: 256 }, false, ["decrypt"]).then(key =>
						crypto.subtle.decrypt({ "name": "AES-GCM", "iv": iv, "additionalData": additionalData }, key, data)
					);
				}
				else
					throw new Error('Argument 4 "iv" should be a Uint8Array of length 16');
			}
			else
				throw new Error('Argument 3 "password" should be a Uint8Array of length 32');
		}
		else
			throw new Error('Argument 1 "data" should be a non-empty Uint8Array');
	}
	else
		throw new Error('Argument 1 "data" should be a non-empty Uint8Array');
}

function TextualIdentityValidationError(rowNr, colNr, msg)
{
	this.rowNr = rowNr;
	this.colNr = colNr;
	this.msg = msg;
}
function validateTextualIdentity(ti)
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
			let b56match = block.match(base56invalidsCharsRe);
			if (b56match)
				return { "success": false, "lineNr": lIndex, "blockNr": bIndex, "message": `Invalid character "${b56match[1]}" on line ${lIndex + 1}.\nA block can only contain valid base56 characters.` };
		}
		//The final character on each line is a line checksum character formed by taking the (SHA256 mod 56) hashing of the line's previous characters plus the 0-based line number.
		if (line.length == 24 || (lIndex == 5 && line.length == 8)) //FIXME: this only works for type2 data, user can enter type2 + type3 data.
		{
			let lineChars = blocks.join("");
			let verificationChar = lineChars.slice(-1);
			let lineCharInts = str2ab(lineChars);
			lineCharInts[lineCharInts.length - 1] = lIndex;
			let sha256 = sodium.crypto_hash_sha256(lineCharInts).reverse();
			let sha256bn = new BN(sha256);
			memzero(sha256);
			let verificationInt = sha256bn.modn(56);
			memzero(sha256bn);
			if (verificationChar !== base56chars[verificationInt])
				return { "success": false, "lineNr": lIndex, "message": `Verification character mismatch on line ${lIndex + 1}.\nOne or more of the characters on this line is wrong.` };
		}
	}
	return { "success": true, "lineNr": lines.length };
}



function base64url_encode(str)
{
	return sodium.to_base64(sodium.from_string(str), sodium.base64_variants.URLSAFE_NO_PADDING);
}
//uses BigNum, https://github.com/indutny/bn.js/
function base56encode(i)
{
	let bi;
	if (i instanceof BN)
		bi = i;
	else if (typeof i == "string")
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

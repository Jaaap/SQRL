{
"use strict";

function onCreateFormSubmit(evt)
{
	evt.preventDefault();
	console.log(this, evt);
}
function onImportFormSubmit(evt)
{
	evt.preventDefault();
	console.log(this, evt);
	let elems = this.elements;
	chrome.runtime.sendMessage({'action': 'importIdentity', "textualIdentity": elems.identity.value, "rescueCode": elems.rescuecode.value }, result => {
		console.log("onImportFormSubmit", result);
		elems[elems.length - 1].className = result.success ? "success" : "failure";
		if (result.success)
		{
			elems.identity.value = "";
			elems.rescuecode.value = "";
		}
	});
}
/*
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
		if (lIndex < lines.length - 1 || (lIndex > 4 && line.length > 7)) //FIXME: this only works for type2 data, user can enter type2 + type3 data.
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
				return { "success": false, "lineNr": lIndex, "message": "Verification character mismatch.\nOne or more of the characters on this line is wrong." };
		}
	}
	return { "success": true, "lineNr": lines.length };
}
*/

function onTextualIdentityKeyUp(evt)
{
	let ta = evt.target;
	let validationData = validateTextualIdentity(ta.value);
	$('form#import label+b').text(new Array(validationData.lineNr + 1).join('✅ ') + (validationData.success ? '' : '❌')).attr("title", validationData.message||"");
	$('form#import textarea[name="identity"]')[0].setCustomValidity(validationData.message||"");
}
function onChangepasswordFormSubmit(evt)
{
	evt.preventDefault();
	console.log(this, evt);
}
function onDeletepasswordFormSubmit(evt)
{
	evt.preventDefault();
	console.log(this, evt);
}
function onEraseidentityFormSubmit(evt)
{
	evt.preventDefault();
	chrome.runtime.sendMessage({'action': 'eraseIdentity' }, error => {
		let btn = $('form#eraseidentity button')[0];
		btn.className = error ? "failure" : "success";
		btn.title = error || "";
		setTabsEnabling(false);
	});
}
function onSettingsFormSubmit(evt)
{
	evt.preventDefault();
	console.log(this, evt);
}
function setTabsEnabling(hasIdentity)
{
	$('#tab3,#tab4,#tab5,#tab6').enable(hasIdentity);
	$('#tab1,#tab2').enable(!hasIdentity);
}
function init()
{
	// [ form#create, form#import, form#changepassword, form#deletepassword, form#eraseidentity, form#settings ]
	$('form#create').submit(onCreateFormSubmit);
	$('form#import').submit(onImportFormSubmit);
	$('form#changepassword').submit(onChangepasswordFormSubmit);
	$('form#deletepassword').submit(onDeletepasswordFormSubmit);
	$('form#eraseidentity').submit(onEraseidentityFormSubmit);
	$('form#settings').submit(onSettingsFormSubmit);
	$('form#import textarea[name="identity"]').keyup(onTextualIdentityKeyUp);
	if ("chrome" in window)
	{
		chrome.runtime.sendMessage({'action': 'hasIdentity' }, hasIdentity => {
			setTabsEnabling(hasIdentity);
		});
	}
}

document.addEventListener("DOMContentLoaded", init);

}

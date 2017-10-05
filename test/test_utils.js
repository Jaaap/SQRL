var expect = chai.expect;
chai.config.truncateThreshold = 0;
//"hostname","port","pathname","search"]
describe("utils", function() {
	describe("memzero", function() {
		it("", function() {
			let ui8a = new Uint8Array(0);
			memzero(ui8a);
			expect(ui8a).to.deep.equal(new Uint8Array(0));
			ui8a = new Uint8Array(32);
			memzero(ui8a);
			expect(ui8a).to.deep.equal(new Uint8Array(32));
			ui8a = new Uint8Array([1,255,0,55]);
			memzero(ui8a);
			expect(ui8a).to.deep.equal(new Uint8Array(4));
		});
	});
	describe("base56", function() {
		it("encode", function() {
			expect(function(){ base56encode(-1); }).to.throw('base56encode: ERROR. Argument 1 "i" should be positive');
			expect(base56encode(0)).to.equal("2");
			expect(base56encode(1)).to.equal("3");
			expect(base56encode(55)).to.equal("z");
			expect(base56encode(56)).to.equal("23");
			expect(base56encode("56")).to.equal("23");
			expect(base56encode("00")).to.equal("2");
			expect(base56encode(Number.MAX_SAFE_INTEGER)).to.equal("ZeAxbxE9f3");
			expect(base56encode(new BN(Number.MAX_SAFE_INTEGER))).to.equal("ZeAxbxE9f3");
		});
		it("decode", function() {
			expect(base56decode("2")).to.deep.equal(new BN(0));
			expect(base56decode("3")).to.deep.equal(new BN(1));
			expect(base56decode("z")).to.deep.equal(new BN(55));
			expect(base56decode("23")).to.deep.equal(new BN(56));
			expect(base56decode("ZeAxbxE9f3")).to.deep.equal(new BN(Number.MAX_SAFE_INTEGER));
		});
		it("transcode", function() {
			for (let i = 0; i < 10000; i++)
			{
				expect(base56decode(base56encode(i)).toNumber()).to.equal(i);
				let squared = i * i; //don't go over Number.MAX_SAFE_INTEGER!
				expect(base56decode(base56encode(squared)).toNumber()).to.equal(squared);
			}
		});
	});
	describe("enscrypt", function() {
		scrypt_module_factory(function(scrypt){
			it("password 1i", function() {
				expect(ab2hex(enscrypt(scrypt.crypto_scrypt, scrypt.encode_utf8("password"), new Uint8Array(32), 1))).to.equal("532bcc911c16df81996258158de460b2e59d9a86531d59661da5fbeb69f7cd54");
			});
			it("password 2i", function() {
				expect(ab2hex(enscrypt(scrypt.crypto_scrypt, scrypt.encode_utf8("password"), new Uint8Array(32), 2))).to.equal("2d516e99bceb1f49e4dc02217ffc6bac28ea1a9b2d67c1dabd85185163ffe2de");
			});
			it("password 3i", function() {
				expect(ab2hex(enscrypt(scrypt.crypto_scrypt, scrypt.encode_utf8("password"), new Uint8Array(32), 3))).to.equal("7b1bebe5b2e4afc8d2520abbd6e4d7f1420b018477065577c5d684690198195d");
			});
		});
	});
});

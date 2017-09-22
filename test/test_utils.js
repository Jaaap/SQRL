var expect = chai.expect;
chai.config.truncateThreshold = 0;
//"hostname","port","pathname","search"]
describe("utils", function() {
	describe("base56", function() {
		it("encode", function() {
			expect(function(){ base56encode(-1); }).to.throw('base56encode: ERROR. Argument 1 "i" should be positive');
			expect(base56encode(0)).to.equal("2");
			expect(base56encode(1)).to.equal("3");
			expect(base56encode(55)).to.equal("z");
			expect(base56encode(56)).to.equal("32");
			expect(base56encode("56")).to.equal("32");
			expect(base56encode("00")).to.equal("2");
			expect(base56encode(Number.MAX_SAFE_INTEGER)).to.equal("3f9ExbxAeZ");
			expect(base56encode(bigInt(Number.MAX_SAFE_INTEGER))).to.equal("3f9ExbxAeZ");
		});
		it("decode", function() {
			expect(base56decode("2")).to.deep.equal(bigInt(0));
			expect(base56decode("3")).to.deep.equal(bigInt(1));
			expect(base56decode("z")).to.deep.equal(bigInt(55));
			expect(base56decode("32")).to.deep.equal(bigInt(56));
			expect(base56decode("3f9ExbxAeZ")).to.deep.equal(bigInt(Number.MAX_SAFE_INTEGER));
		});
		it("transcode", function() {
			for (let i = 0; i < 100000; i++)
			{
				expect(base56decode(base56encode(i)).toJSNumber()).to.equal(i);
				let squared = i * i; //don't go over Number.MAX_SAFE_INTEGER!
				expect(base56decode(base56encode(squared)).toJSNumber()).to.equal(squared);
			}
		});
	});
});

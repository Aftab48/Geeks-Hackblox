import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";

const URI = "ipfs://QmTestMetadataHash";

async function deployFixture() {
  const [admin, issuer, student, outsider] = await ethers.getSigners();
  const factory = await ethers.getContractFactory("SoulboundCertificate");
  const contract = await factory.deploy("HackBlox University");
  await contract.waitForDeployment();
  return { contract, admin, issuer, student, outsider };
}

describe("SoulboundCertificate", () => {
  describe("issuing", () => {
    it("lets a whitelisted issuer mint to a student", async () => {
      const { contract, admin, student } = await loadFixture(deployFixture);

      await expect(
        contract.issueCertificate(student.address, "Ada Lovelace", "Solidity 101", URI)
      )
        .to.emit(contract, "CertificateIssued")
        .withArgs(1n, student.address, admin.address, "Solidity 101");

      expect(await contract.ownerOf(1)).to.equal(student.address);
      expect(await contract.certificateCount(student.address)).to.equal(1n);
      expect(await contract.totalIssued()).to.equal(1n);

      const cert = await contract.getCertificate(1);
      expect(cert.recipientName).to.equal("Ada Lovelace");
      expect(cert.courseName).to.equal("Solidity 101");
      expect(cert.issuerName).to.equal("HackBlox University");
      expect(cert.revoked).to.equal(false);
      expect(cert.uri).to.equal(URI);
    });

    it("rejects a mint from a non-issuer", async () => {
      const { contract, student, outsider } = await loadFixture(deployFixture);

      await expect(
        contract
          .connect(outsider)
          .issueCertificate(student.address, "Mallory", "Fake Degree", URI)
      ).to.be.revertedWithCustomError(contract, "AccessControlUnauthorizedAccount");
    });

    it("lets an admin whitelist a new issuer who can then mint", async () => {
      const { contract, issuer, student } = await loadFixture(deployFixture);

      expect(await contract.isIssuer(issuer.address)).to.equal(false);
      await contract.addIssuer(issuer.address, "MIT");
      expect(await contract.isIssuer(issuer.address)).to.equal(true);

      await contract
        .connect(issuer)
        .issueCertificate(student.address, "Grace Hopper", "Distributed Systems", URI);

      const cert = await contract.getCertificate(1);
      expect(cert.issuer).to.equal(issuer.address);
      expect(cert.issuerName).to.equal("MIT");
    });

    it("returns every certificate held by a wallet", async () => {
      const { contract, student } = await loadFixture(deployFixture);

      await contract.issueCertificate(student.address, "Ada", "Solidity 101", URI);
      await contract.issueCertificate(student.address, "Ada", "Advanced EVM", URI);

      const certs = await contract.getCertificates(student.address);
      expect(certs.length).to.equal(2);
      expect(certs[0].courseName).to.equal("Solidity 101");
      expect(certs[1].courseName).to.equal("Advanced EVM");
    });
  });

  describe("soulbound enforcement", () => {
    it("blocks transfers after minting", async () => {
      const { contract, student, outsider } = await loadFixture(deployFixture);
      await contract.issueCertificate(student.address, "Ada", "Solidity 101", URI);

      await expect(
        contract
          .connect(student)
          .transferFrom(student.address, outsider.address, 1)
      ).to.be.revertedWithCustomError(contract, "SoulboundTransferNotAllowed");

      expect(await contract.ownerOf(1)).to.equal(student.address);
    });

    it("blocks approvals so a marketplace cannot list it", async () => {
      const { contract, student, outsider } = await loadFixture(deployFixture);
      await contract.issueCertificate(student.address, "Ada", "Solidity 101", URI);

      await expect(
        contract.connect(student).approve(outsider.address, 1)
      ).to.be.revertedWithCustomError(contract, "SoulboundApprovalNotAllowed");

      await expect(
        contract.connect(student).setApprovalForAll(outsider.address, true)
      ).to.be.revertedWithCustomError(contract, "SoulboundApprovalNotAllowed");
    });
  });

  describe("revocation", () => {
    it("flips validity without moving the token", async () => {
      const { contract, admin, student } = await loadFixture(deployFixture);
      await contract.issueCertificate(student.address, "Ada", "Solidity 101", URI);

      expect(await contract.isValid(1)).to.equal(true);

      await expect(contract.revoke(1))
        .to.emit(contract, "CertificateRevoked")
        .withArgs(1n, admin.address);

      expect(await contract.isValid(1)).to.equal(false);
      // still in the student's wallet, just marked invalid
      expect(await contract.ownerOf(1)).to.equal(student.address);
      expect((await contract.getCertificate(1)).revoked).to.equal(true);
    });

    it("stops a stranger from revoking someone else's certificate", async () => {
      const { contract, student, outsider } = await loadFixture(deployFixture);
      await contract.issueCertificate(student.address, "Ada", "Solidity 101", URI);

      await expect(
        contract.connect(outsider).revoke(1)
      ).to.be.revertedWithCustomError(contract, "NotCertificateIssuer");
    });

    it("reverts when revoking a certificate that does not exist", async () => {
      const { contract } = await loadFixture(deployFixture);
      await expect(contract.revoke(999)).to.be.revertedWithCustomError(
        contract,
        "CertificateDoesNotExist"
      );
    });
  });
});

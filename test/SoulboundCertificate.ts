import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";

const URI = "ipfs://QmTestMetadataHash";

async function deployFixture() {
  const [admin, issuer, student, outsider, registrar, deputy] =
    await ethers.getSigners();
  const factory = await ethers.getContractFactory("SoulboundCertificate");
  const contract = await factory.deploy("HackBlox University");
  await contract.waitForDeployment();
  return { contract, admin, issuer, student, outsider, registrar, deputy };
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

    it("lets the appointing registrar revoke what its issuer minted", async () => {
      const { contract, registrar, deputy, issuer, student } =
        await loadFixture(deployFixture);

      await contract.addRegistrar(registrar.address, "Faculty of Science");
      await contract.addRegistrar(deputy.address, "Faculty of Arts");
      await contract.connect(registrar).addIssuer(issuer.address, "Dept of CS");
      await contract
        .connect(issuer)
        .issueCertificate(student.address, "Ada", "Solidity 101", URI);

      // A registrar from another faculty has no business touching it.
      await expect(
        contract.connect(deputy).revoke(1)
      ).to.be.revertedWithCustomError(contract, "NotCertificateIssuer");

      await expect(contract.connect(registrar).revoke(1))
        .to.emit(contract, "CertificateRevoked")
        .withArgs(1n, registrar.address);
      expect(await contract.isValid(1)).to.equal(false);
    });
  });

  describe("issuer hierarchy", () => {
    it("runs admin to registrar to issuer, and stops there", async () => {
      const { contract, registrar, issuer, student, outsider } =
        await loadFixture(deployFixture);

      await expect(contract.addRegistrar(registrar.address, "Faculty of Science"))
        .to.emit(contract, "RegistrarAdded")
        .withArgs(registrar.address, "Faculty of Science");

      await expect(contract.connect(registrar).addIssuer(issuer.address, "Dept of CS"))
        .to.emit(contract, "IssuerAdded")
        .withArgs(issuer.address, "Dept of CS", registrar.address);

      expect(await contract.appointedBy(issuer.address)).to.equal(registrar.address);
      await contract
        .connect(issuer)
        .issueCertificate(student.address, "Ada", "Solidity 101", URI);
      expect((await contract.getCertificate(1)).issuerName).to.equal("Dept of CS");

      // An issuer is the bottom rung: it can't appoint anyone.
      await expect(
        contract.connect(issuer).addIssuer(outsider.address, "Fake Dept")
      ).to.be.revertedWithCustomError(contract, "AccessControlUnauthorizedAccount");

      // Nor can a registrar mint itself a peer.
      await expect(
        contract.connect(registrar).addRegistrar(outsider.address, "Faculty of Mischief")
      ).to.be.revertedWithCustomError(contract, "AccessControlUnauthorizedAccount");
    });

    it("holds the line on the raw grantRole path too", async () => {
      const { contract, outsider, issuer } = await loadFixture(deployFixture);
      const issuerRole = await contract.ISSUER_ROLE();

      expect(await contract.getRoleAdmin(issuerRole)).to.equal(
        await contract.REGISTRAR_ROLE()
      );
      await expect(
        contract.connect(outsider).grantRole(issuerRole, issuer.address)
      ).to.be.revertedWithCustomError(contract, "AccessControlUnauthorizedAccount");
    });

    it("lets a registrar strip only the issuers it appointed", async () => {
      const { contract, registrar, deputy, issuer } = await loadFixture(deployFixture);

      await contract.addRegistrar(registrar.address, "Faculty of Science");
      await contract.addRegistrar(deputy.address, "Faculty of Arts");
      await contract.connect(registrar).addIssuer(issuer.address, "Dept of CS");

      await expect(
        contract.connect(deputy).removeIssuer(issuer.address)
      ).to.be.revertedWithCustomError(contract, "NotTheAppointingRegistrar");

      await expect(contract.connect(registrar).removeIssuer(issuer.address))
        .to.emit(contract, "IssuerRemoved")
        .withArgs(issuer.address, registrar.address);

      expect(await contract.isIssuer(issuer.address)).to.equal(false);
      expect(await contract.appointedBy(issuer.address)).to.equal(ethers.ZeroAddress);
      await expect(
        contract.removeIssuer(issuer.address)
      ).to.be.revertedWithCustomError(contract, "NotAnIssuer");
    });

    it("cuts off a registrar's appointments once the admin removes it", async () => {
      const { contract, registrar, issuer, outsider } = await loadFixture(deployFixture);

      await contract.addRegistrar(registrar.address, "Faculty of Science");
      await contract.connect(registrar).addIssuer(issuer.address, "Dept of CS");
      await contract.removeRegistrar(registrar.address);

      await expect(
        contract.connect(registrar).addIssuer(outsider.address, "Dept of Nothing")
      ).to.be.revertedWithCustomError(contract, "AccessControlUnauthorizedAccount");

      // The issuer it already appointed keeps working; the admin cleans up.
      expect(await contract.isIssuer(issuer.address)).to.equal(true);
      await contract.removeIssuer(issuer.address);
      expect(await contract.isIssuer(issuer.address)).to.equal(false);
    });
  });

  describe("register numbers", () => {
    it("mints when the artwork's register number is still free", async () => {
      const { contract, student } = await loadFixture(deployFixture);

      expect(await contract.nextTokenId()).to.equal(1n);
      await expect(
        contract.issueCertificateAt(student.address, "Ada", "Solidity 101", URI, 1)
      )
        .to.emit(contract, "CertificateIssued")
        .withArgs(1n, student.address, (await ethers.getSigners())[0].address, "Solidity 101");
      expect(await contract.nextTokenId()).to.equal(2n);
    });

    it("refuses the mint when someone else took that number first", async () => {
      const { contract, registrar, issuer, student } = await loadFixture(deployFixture);

      await contract.addRegistrar(registrar.address, "Faculty of Science");
      await contract.connect(registrar).addIssuer(issuer.address, "Dept of CS");

      // Two issuers both prepared artwork stamped 001. Only one can have it.
      await contract.issueCertificateAt(student.address, "Ada", "Solidity 101", URI, 1);

      await expect(
        contract
          .connect(issuer)
          .issueCertificateAt(student.address, "Grace", "Advanced EVM", URI, 1)
      )
        .to.be.revertedWithCustomError(contract, "RegisterEntryTaken")
        .withArgs(2n);

      // Rebuild against the number the revert handed back and it goes through.
      await contract
        .connect(issuer)
        .issueCertificateAt(student.address, "Grace", "Advanced EVM", URI, 2);
      expect(await contract.ownerOf(2)).to.equal(student.address);
      expect(await contract.totalIssued()).to.equal(2n);
    });
  });
});

/**
 * GRC Platform – Database Seed
 * Populates NIST CSF 2.0 & CIS Controls v8.1 framework data,
 * sample internal controls with cross-framework mappings,
 * and a sample risk register.
 */

import { PrismaClient, FrameworkSlug, ControlStatus, RiskLikelihood, RiskImpact, RiskVelocity, RiskTreatment } from "@prisma/client";

const prisma = new PrismaClient();

// ─── NIST CSF 2.0 Requirements (selected representative controls) ─────────────
const nistRequirements = [
  // GOVERN function
  { controlId: "GV.OC-01", category: "GOVERN", subCategory: "Organizational Context", title: "Organizational Mission & Cybersecurity Risk Strategy", description: "The organizational mission is understood and informs cybersecurity risk management strategy, roles, responsibilities, and policies." },
  { controlId: "GV.OC-02", category: "GOVERN", subCategory: "Organizational Context", title: "Internal & External Stakeholder Risk Roles", description: "Internal and external stakeholders are understood, and their needs and expectations regarding cybersecurity risk management are considered." },
  { controlId: "GV.RM-01", category: "GOVERN", subCategory: "Risk Management Strategy", title: "Risk Management Policy", description: "Risk management objectives are established and agreed upon by organizational stakeholders." },
  { controlId: "GV.RM-02", category: "GOVERN", subCategory: "Risk Management Strategy", title: "Risk Appetite & Tolerance", description: "Risk appetite and risk tolerance statements are established, communicated, and maintained." },
  { controlId: "GV.SC-01", category: "GOVERN", subCategory: "Supply Chain Risk Management", title: "Supply Chain Risk Management Policy", description: "A cybersecurity supply chain risk management program, strategy, objectives, policies, and processes are established and agreed upon by organizational stakeholders." },
  { controlId: "GV.RR-01", category: "GOVERN", subCategory: "Roles, Responsibilities & Authorities", title: "Cybersecurity Roles & Responsibilities", description: "Organizational leadership is responsible and accountable for cybersecurity risk and fosters a culture that is risk-aware, ethical, and continually improving." },
  { controlId: "GV.PO-01", category: "GOVERN", subCategory: "Policy", title: "Cybersecurity Policy", description: "Policy for managing cybersecurity risks is established based on organizational context, cybersecurity strategy, and priorities and is communicated and enforced." },
  // IDENTIFY function
  { controlId: "ID.AM-01", category: "IDENTIFY", subCategory: "Asset Management", title: "Hardware Asset Inventory", description: "Inventories of hardware managed by the organization are maintained." },
  { controlId: "ID.AM-02", category: "IDENTIFY", subCategory: "Asset Management", title: "Software Asset Inventory", description: "Inventories of software, services, and systems managed by the organization are maintained." },
  { controlId: "ID.AM-03", category: "IDENTIFY", subCategory: "Asset Management", title: "Network Representation", description: "Representations of the organization's authorized network communication and internal and external network data flows are maintained." },
  { controlId: "ID.AM-07", category: "IDENTIFY", subCategory: "Asset Management", title: "Data Classification", description: "Inventories of data and corresponding metadata for designated data types are maintained." },
  { controlId: "ID.RA-01", category: "IDENTIFY", subCategory: "Risk Assessment", title: "Vulnerability Identification", description: "Vulnerabilities in assets are identified, validated, and recorded." },
  { controlId: "ID.RA-02", category: "IDENTIFY", subCategory: "Risk Assessment", title: "Threat Intelligence Sharing", description: "Cyber threat intelligence is received from information sharing forums and sources." },
  { controlId: "ID.RA-03", category: "IDENTIFY", subCategory: "Risk Assessment", title: "Threat Identification", description: "Internal and external threats to the organization are identified and recorded." },
  { controlId: "ID.RA-05", category: "IDENTIFY", subCategory: "Risk Assessment", title: "Risk Analysis", description: "Threats, vulnerabilities, likelihoods, and impacts are used to understand inherent risk and inform prioritization." },
  { controlId: "ID.IM-01", category: "IDENTIFY", subCategory: "Improvement", title: "Improvements from Assessments", description: "Improvements are identified from evaluations, such as audits, assessments, and exercises." },
  // PROTECT function
  { controlId: "PR.AA-01", category: "PROTECT", subCategory: "Identity Management, Authentication & Access Control", title: "Identity & Credential Management", description: "Identities and credentials for authorized users, services, and hardware are managed by the organization." },
  { controlId: "PR.AA-02", category: "PROTECT", subCategory: "Identity Management, Authentication & Access Control", title: "Identity Proofing", description: "Identities are proofed and bound to credentials based on the context of interactions." },
  { controlId: "PR.AA-03", category: "PROTECT", subCategory: "Identity Management, Authentication & Access Control", title: "User Authentication", description: "Users, services, and hardware are authenticated." },
  { controlId: "PR.AA-05", category: "PROTECT", subCategory: "Identity Management, Authentication & Access Control", title: "Access Rights Management", description: "Access permissions, entitlements, and authorizations are defined in a policy, managed, enforced, and reviewed, and incorporate principles of least privilege and separation of duties." },
  { controlId: "PR.AT-01", category: "PROTECT", subCategory: "Awareness & Training", title: "Security Awareness Training", description: "Personnel are provided with awareness and training so that they possess the knowledge and skills to perform general tasks with cybersecurity risks in mind." },
  { controlId: "PR.DS-01", category: "PROTECT", subCategory: "Data Security", title: "Data at Rest Protection", description: "The confidentiality, integrity, and availability of data-at-rest are protected." },
  { controlId: "PR.DS-02", category: "PROTECT", subCategory: "Data Security", title: "Data in Transit Protection", description: "The confidentiality, integrity, and availability of data-in-transit are protected." },
  { controlId: "PR.DS-10", category: "PROTECT", subCategory: "Data Security", title: "Data in Use Protection", description: "The confidentiality, integrity, and availability of data-in-use are protected." },
  { controlId: "PR.IR-01", category: "PROTECT", subCategory: "Technology Infrastructure Resilience", title: "Configuration Management", description: "Networks and environments are protected from unauthorized logical access and usage." },
  { controlId: "PR.PS-01", category: "PROTECT", subCategory: "Platform Security", title: "Configuration Baselines", description: "Configuration management practices are established and applied." },
  { controlId: "PR.PS-02", category: "PROTECT", subCategory: "Platform Security", title: "Software Lifecycle Management", description: "Software is maintained, replaced, and removed commensurate with risk." },
  // DETECT function
  { controlId: "DE.AE-02", category: "DETECT", subCategory: "Adverse Event Analysis", title: "Event Analysis", description: "Potentially adverse events are analyzed to better understand associated activities." },
  { controlId: "DE.AE-03", category: "DETECT", subCategory: "Adverse Event Analysis", title: "Event Correlation", description: "Information is correlated from multiple sources." },
  { controlId: "DE.AE-06", category: "DETECT", subCategory: "Adverse Event Analysis", title: "Incident Declaration", description: "Information on adverse events is provided to authorized staff and tools." },
  { controlId: "DE.CM-01", category: "DETECT", subCategory: "Continuous Monitoring", title: "Network Monitoring", description: "Networks and network services are monitored to find potentially adverse events." },
  { controlId: "DE.CM-03", category: "DETECT", subCategory: "Continuous Monitoring", title: "Personnel Activity Monitoring", description: "Personnel activity and technology usage are monitored to find potentially adverse events." },
  { controlId: "DE.CM-06", category: "DETECT", subCategory: "Continuous Monitoring", title: "External Service Provider Monitoring", description: "External service provider activities and services are monitored to find potentially adverse events." },
  // RESPOND function
  { controlId: "RS.MA-01", category: "RESPOND", subCategory: "Incident Management", title: "Incident Response Execution", description: "The incident response plan is executed in coordination with relevant third parties once an incident is declared." },
  { controlId: "RS.MA-02", category: "RESPOND", subCategory: "Incident Management", title: "Incident Triage", description: "Incidents are triaged to predict their magnitude and implications." },
  { controlId: "RS.AN-03", category: "RESPOND", subCategory: "Incident Analysis", title: "Root Cause Analysis", description: "Analysis is performed to determine what has taken place during an incident and the root cause of the incident." },
  { controlId: "RS.CO-02", category: "RESPOND", subCategory: "Incident Response Reporting & Communication", title: "Incident Reporting", description: "Internal and external stakeholders are notified of incidents." },
  { controlId: "RS.MI-01", category: "RESPOND", subCategory: "Incident Mitigation", title: "Incident Containment", description: "Incidents are contained." },
  // RECOVER function
  { controlId: "RC.RP-01", category: "RECOVER", subCategory: "Incident Recovery Plan Execution", title: "Recovery Plan Execution", description: "The recovery portion of the incident response plan is executed once initiated from the incident response process." },
  { controlId: "RC.RP-03", category: "RECOVER", subCategory: "Incident Recovery Plan Execution", title: "Recovery Verification", description: "The integrity of backups and other restoration assets is verified before using them for restoration." },
  { controlId: "RC.CO-03", category: "RECOVER", subCategory: "Incident Recovery Communication", title: "Recovery Communications", description: "Recovery activities and progress in restoring operational capabilities are communicated to designated internal and external stakeholders." },
  { controlId: "RC.RP-05", category: "RECOVER", subCategory: "Incident Recovery Plan Execution", title: "Recovery Plan Testing", description: "The integrity of the Recovery Plan is tested." },
];

// ─── CIS Controls v8.1 Requirements (all 18 control families) ─
const cisRequirements = [
  // IG1 Controls (Basic hygiene - must do)
  { controlId: "CIS-1.1", category: "CIS IG1", subCategory: "Control 1: Inventory & Control of Enterprise Assets", title: "Establish & Maintain Detailed Asset Inventory", description: "Establish and maintain an accurate, detailed, and up-to-date inventory of all enterprise assets with the potential to store or process data, to include: end-user devices, network devices, non-computing/IoT devices, and servers.", weight: 3 },
  { controlId: "CIS-2.1", category: "CIS IG1", subCategory: "Control 2: Inventory & Control of Software Assets", title: "Establish & Maintain a Software Inventory", description: "Establish and maintain a detailed inventory of all licensed software installed on enterprise assets. The software inventory must document the title, publisher, initial install/use date, and business purpose for each entry.", weight: 3 },
  { controlId: "CIS-3.3", category: "CIS IG1", subCategory: "Control 3: Data Protection", title: "Configure Data Access Control Lists", description: "Configure data access control lists based on a user's need to know. Apply data access control lists, also known as access permissions, to local and remote file systems, databases, and applications.", weight: 3 },
  { controlId: "CIS-4.1", category: "CIS IG1", subCategory: "Control 4: Secure Configuration of Enterprise Assets & Software", title: "Establish & Maintain a Secure Configuration Process", description: "Establish and maintain a secure configuration process for enterprise assets (end-user devices, including portable and mobile, non-computing/IoT devices, and servers) and software.", weight: 3 },
  { controlId: "CIS-5.1", category: "CIS IG1", subCategory: "Control 5: Account Management", title: "Establish & Maintain an Inventory of Accounts", description: "Establish and maintain an inventory of all accounts managed in the enterprise. The inventory must include both user and administrator accounts.", weight: 3 },
  { controlId: "CIS-5.2", category: "CIS IG1", subCategory: "Control 5: Account Management", title: "Use Unique Passwords", description: "Use unique passwords for all enterprise assets. Best practice implementation includes a password manager, but at minimum the organization should not be using the same password for multiple accounts.", weight: 3 },
  { controlId: "CIS-6.1", category: "CIS IG1", subCategory: "Control 6: Access Control Management", title: "Establish an Access Granting Process", description: "Establish and follow a process, preferably automated, for granting access to enterprise assets upon new hire, rights grant, or role change of a user.", weight: 3 },
  { controlId: "CIS-6.2", category: "CIS IG1", subCategory: "Control 6: Access Control Management", title: "Establish an Access Revoking Process", description: "Establish and follow a process, preferably automated, for revoking access to enterprise assets, through disabling accounts immediately upon termination, rights revocation, or role change of a user.", weight: 3 },
  { controlId: "CIS-7.1", category: "CIS IG1", subCategory: "Control 7: Continuous Vulnerability Management", title: "Establish & Maintain a Vulnerability Management Process", description: "Establish and maintain a documented vulnerability management process for enterprise assets. Review and update documentation annually, or when significant enterprise changes occur that could impact this Safeguard.", weight: 3 },
  { controlId: "CIS-7.2", category: "CIS IG1", subCategory: "Control 7: Continuous Vulnerability Management", title: "Establish & Maintain a Remediation Process", description: "Establish and maintain a risk-based remediation strategy documented in a remediation process, with monthly, or more frequent, reviews.", weight: 3 },
  { controlId: "CIS-8.1", category: "CIS IG1", subCategory: "Control 8: Audit Log Management", title: "Establish & Maintain an Audit Log Management Process", description: "Establish and maintain an audit log management process that defines the enterprise's logging requirements.", weight: 3 },
  { controlId: "CIS-9.1", category: "CIS IG1", subCategory: "Control 9: Email & Web Browser Protections", title: "Ensure Use of Only Fully Supported Browsers & Email Clients", description: "Ensure only fully supported browsers and email clients are allowed to execute in the enterprise, only using the latest version of browsers and email clients provided through the vendor's support.", weight: 2 },
  { controlId: "CIS-10.1", category: "CIS IG1", subCategory: "Control 10: Malware Defenses", title: "Deploy & Maintain Anti-Malware Software", description: "Deploy and maintain anti-malware software on all enterprise assets.", weight: 3 },
  { controlId: "CIS-11.1", category: "CIS IG1", subCategory: "Control 11: Data Recovery", title: "Establish & Maintain a Data Recovery Process", description: "Establish and maintain a data recovery process. In the process, address the scope of data recovery activities, recovery prioritization, and the security of backup data.", weight: 3 },
  { controlId: "CIS-12.1", category: "CIS IG1", subCategory: "Control 12: Network Infrastructure Management", title: "Ensure Network Infrastructure is Up-to-Date", description: "Ensure network infrastructure is kept up-to-date.", weight: 2 },
  { controlId: "CIS-14.1", category: "CIS IG1", subCategory: "Control 14: Security Awareness & Skills Training", title: "Establish & Maintain a Security Awareness Program", description: "Establish and maintain a security awareness program. The purpose of a security awareness program is to educate the enterprise's workforce on how to interact with enterprise assets and data in a secure manner.", weight: 3 },
  { controlId: "CIS-16.1", category: "CIS IG1", subCategory: "Control 16: Application Software Security", title: "Establish & Maintain a Secure Application Development Process", description: "Establish and maintain a secure application development process. In the process, address such items as secure design, secure coding practices, developer training, code review, and developer security training.", weight: 2 },
  // IG2 Controls
  { controlId: "CIS-3.1", category: "CIS IG2", subCategory: "Control 3: Data Protection", title: "Establish & Maintain a Data Management Process", description: "Establish and maintain a data management process. In the process, address data sensitivity, data owner, handling of data, data retention limits, and disposal requirements, based on sensitivity and retention standards for the enterprise.", weight: 2 },
  { controlId: "CIS-4.2", category: "CIS IG2", subCategory: "Control 4: Secure Configuration", title: "Establish & Maintain a Secure Configuration Process for Network Infrastructure", description: "Establish and maintain a secure configuration process for network devices.", weight: 2 },
  { controlId: "CIS-5.3", category: "CIS IG2", subCategory: "Control 5: Account Management", title: "Disable Dormant Accounts", description: "Delete or disable any dormant accounts after a period of 45 days of inactivity, where supported.", weight: 2 },
  { controlId: "CIS-5.4", category: "CIS IG2", subCategory: "Control 5: Account Management", title: "Restrict Administrator Privileges to Dedicated Administrator Accounts", description: "Restrict administrator privileges to dedicated administrator accounts on enterprise assets. Conduct general computing activities, such as internet browsing, email, and productivity suite use, from the user's primary, non-privileged account.", weight: 2 },
  { controlId: "CIS-6.3", category: "CIS IG2", subCategory: "Control 6: Access Control Management", title: "Require MFA for Externally-Exposed Applications", description: "Require all externally-exposed enterprise or third-party applications to enforce multi-factor authentication, where supported.", weight: 3 },
  { controlId: "CIS-6.4", category: "CIS IG2", subCategory: "Control 6: Access Control Management", title: "Require MFA for Remote Network Access", description: "Require multi-factor authentication for remote network access.", weight: 3 },
  { controlId: "CIS-6.5", category: "CIS IG2", subCategory: "Control 6: Access Control Management", title: "Require MFA for Administrative Access", description: "Require multi-factor authentication for all administrative access accounts, where supported, on all enterprise assets, whether managed on-site or through a third-party provider.", weight: 3 },
  { controlId: "CIS-13.1", category: "CIS IG2", subCategory: "Control 13: Network Monitoring & Defense", title: "Centralize Security Event Alerting", description: "Centralize security event alerting across enterprise assets for log correlation and analysis. Best practice implementation requires the use of a SIEM.", weight: 2 },
  { controlId: "CIS-17.1", category: "CIS IG2", subCategory: "Control 17: Incident Response Management", title: "Designate Personnel to Manage Incident Handling", description: "Designate one key person, and at least one backup, who will manage the enterprise's incident handling process.", weight: 2 },
  { controlId: "CIS-18.1", category: "CIS IG2", subCategory: "Control 18: Penetration Testing", title: "Establish & Maintain a Penetration Testing Program", description: "Establish and maintain a penetration testing program appropriate to the size, complexity, and maturity of the enterprise.", weight: 2 },
];

// ─── Sample Internal Controls (map once → NIST + CIS) ─────────
const internalControls = [
  {
    controlCode: "IC-001",
    title: "Multi-Factor Authentication (MFA) Implementation",
    description: "Enforce MFA across all externally exposed applications, remote access, and administrative consoles using TOTP or hardware tokens.",
    status: ControlStatus.IMPLEMENTED,
    owner: "Identity & Access Management Team",
    category: "Identity & Access Management",
    tags: ["mfa", "authentication", "identity", "access-control"],
    nistMappings: ["PR.AA-03", "PR.AA-05"],
    cisMappings: ["CIS-6.3", "CIS-6.4", "CIS-6.5"],
  },
  {
    controlCode: "IC-002",
    title: "Hardware & Software Asset Inventory",
    description: "Maintain a continuously updated CMDB covering all hardware, software, and network assets. Integrate with network scanning tools for automated discovery.",
    status: ControlStatus.IN_PROGRESS,
    owner: "IT Operations",
    category: "Asset Management",
    tags: ["inventory", "assets", "cmdb", "discovery"],
    nistMappings: ["ID.AM-01", "ID.AM-02", "ID.AM-03"],
    cisMappings: ["CIS-1.1", "CIS-2.1"],
  },
  {
    controlCode: "IC-003",
    title: "Vulnerability Management & Patch Program",
    description: "Conduct monthly authenticated vulnerability scans, prioritize findings by CVSS score, and enforce patch SLAs: Critical ≤72h, High ≤14d, Medium ≤30d.",
    status: ControlStatus.IMPLEMENTED,
    owner: "Security Operations",
    category: "Vulnerability Management",
    tags: ["vulnerability", "patching", "scanning", "cvss"],
    nistMappings: ["ID.RA-01", "ID.RA-05"],
    cisMappings: ["CIS-7.1", "CIS-7.2"],
  },
  {
    controlCode: "IC-004",
    title: "Security Awareness & Phishing Training",
    description: "Deliver annual security awareness training to all staff and monthly simulated phishing campaigns. Track completion and click rates.",
    status: ControlStatus.IMPLEMENTED,
    owner: "Information Security",
    category: "Awareness & Training",
    tags: ["training", "phishing", "awareness", "hr"],
    nistMappings: ["PR.AT-01"],
    cisMappings: ["CIS-14.1"],
  },
  {
    controlCode: "IC-005",
    title: "Data Classification & Access Controls",
    description: "Classify all data assets (Public, Internal, Confidential, Restricted). Apply role-based access controls and enforce least-privilege principle.",
    status: ControlStatus.IN_PROGRESS,
    owner: "Data Governance Team",
    category: "Data Protection",
    tags: ["data-classification", "access-control", "rbac", "least-privilege"],
    nistMappings: ["ID.AM-07", "PR.DS-01", "PR.DS-02"],
    cisMappings: ["CIS-3.1", "CIS-3.3"],
  },
  {
    controlCode: "IC-006",
    title: "SIEM & Security Event Monitoring",
    description: "Deploy and maintain a SIEM platform. Define use cases for correlation rules, alert thresholds, and escalation procedures. Retain logs for 12 months.",
    status: ControlStatus.IN_PROGRESS,
    owner: "SOC Team",
    category: "Detection & Monitoring",
    tags: ["siem", "logging", "monitoring", "alerting", "soc"],
    nistMappings: ["DE.AE-02", "DE.AE-03", "DE.CM-01"],
    cisMappings: ["CIS-8.1", "CIS-13.1"],
  },
  {
    controlCode: "IC-007",
    title: "Incident Response Plan & Playbooks",
    description: "Maintain a documented Incident Response Plan aligned to NIST SP 800-61. Conduct tabletop exercises annually. Define RACI for incident roles.",
    status: ControlStatus.IMPLEMENTED,
    owner: "CISO Office",
    category: "Incident Response",
    tags: ["incident-response", "playbooks", "tabletop", "nist-800-61"],
    nistMappings: ["RS.MA-01", "RS.MA-02", "RS.AN-03", "RS.CO-02", "RS.MI-01"],
    cisMappings: ["CIS-17.1"],
  },
  {
    controlCode: "IC-008",
    title: "Backup & Disaster Recovery",
    description: "Perform daily encrypted backups for critical systems with 90-day retention. Test restoration quarterly. Document RTOs/RPOs and maintain DR runbooks.",
    status: ControlStatus.IMPLEMENTED,
    owner: "Infrastructure Team",
    category: "Resilience & Recovery",
    tags: ["backup", "disaster-recovery", "rto", "rpo", "encryption"],
    nistMappings: ["RC.RP-01", "RC.RP-03", "RC.RP-05"],
    cisMappings: ["CIS-11.1"],
  },
  {
    controlCode: "IC-009",
    title: "Secure Configuration Baselines",
    description: "Define and enforce CIS Benchmark-aligned configuration baselines for all servers, endpoints, and network devices. Use automated compliance scanning (e.g., Ansible).",
    status: ControlStatus.NOT_STARTED,
    owner: "Platform Engineering",
    category: "Configuration Management",
    tags: ["hardening", "baselines", "cis-benchmarks", "configuration"],
    nistMappings: ["PR.PS-01", "PR.PS-02", "PR.IR-01"],
    cisMappings: ["CIS-4.1", "CIS-4.2", "CIS-12.1"],
  },
  {
    controlCode: "IC-010",
    title: "Endpoint Detection & Response (EDR)",
    description: "Deploy EDR solution on all managed endpoints. Configure real-time threat detection, automated quarantine, and integration with SIEM.",
    status: ControlStatus.IN_PROGRESS,
    owner: "Security Operations",
    category: "Endpoint Security",
    tags: ["edr", "endpoint", "malware", "threat-detection"],
    nistMappings: ["DE.CM-03", "DE.AE-06"],
    cisMappings: ["CIS-10.1"],
  },
  {
    controlCode: "IC-011",
    title: "Account Lifecycle Management",
    description: "Automate provisioning and de-provisioning of accounts via HR system integration. Review privileged accounts quarterly. Disable dormant accounts after 45 days.",
    status: ControlStatus.IMPLEMENTED,
    owner: "Identity & Access Management Team",
    category: "Identity & Access Management",
    tags: ["account-management", "provisioning", "iam", "lifecycle"],
    nistMappings: ["PR.AA-01", "PR.AA-02"],
    cisMappings: ["CIS-5.1", "CIS-5.2", "CIS-5.3", "CIS-5.4", "CIS-6.1", "CIS-6.2"],
  },
  {
    controlCode: "IC-012",
    title: "Penetration Testing Program",
    description: "Conduct external and internal penetration tests annually, or after major system changes. Engage a qualified third-party firm. Track and remediate findings.",
    status: ControlStatus.NOT_STARTED,
    owner: "CISO Office",
    category: "Security Testing",
    tags: ["pentest", "red-team", "third-party", "assessment"],
    nistMappings: ["ID.RA-01", "ID.IM-01"],
    cisMappings: ["CIS-18.1"],
  },
  {
    controlCode: "IC-013",
    title: "Cybersecurity Risk Management Policy",
    description: "Maintain a board-approved cybersecurity risk management policy covering appetite, tolerance, treatment options, and review cadence. Align to NIST CSF 2.0 GOVERN function.",
    status: ControlStatus.IMPLEMENTED,
    owner: "CISO Office",
    category: "Governance",
    tags: ["policy", "risk-management", "governance", "board"],
    nistMappings: ["GV.OC-01", "GV.RM-01", "GV.RM-02", "GV.PO-01", "GV.RR-01"],
    cisMappings: [],
  },
  {
    controlCode: "IC-014",
    title: "Supply Chain Risk Management",
    description: "Maintain an inventory of critical third-party suppliers. Conduct annual security risk assessments of key vendors. Include security clauses in contracts.",
    status: ControlStatus.NOT_STARTED,
    owner: "Procurement & Security",
    category: "Supply Chain",
    tags: ["third-party", "vendor", "supply-chain", "contracts"],
    nistMappings: ["GV.SC-01", "GV.OC-02"],
    cisMappings: [],
  },
];

// ─── Sample Risks ──────────────────────────────────────────────
const sampleRisks = [
  {
    riskId: "RISK-001",
    title: "Ransomware Attack on Production Systems",
    description: "Threat actors deploy ransomware via phishing email or unpatched vulnerability, encrypting critical servers and causing operational disruption.",
    category: "Cybersecurity",
    owner: "CISO",
    likelihood: RiskLikelihood.LIKELY,
    impact: RiskImpact.CRITICAL,
    velocity: RiskVelocity.FAST,
    inherentScore: 20,
    residualScore: 8,
    treatment: RiskTreatment.MITIGATE,
    treatmentDetails: "Deploy EDR, enforce MFA, conduct phishing training, maintain tested backups. Residual risk accepted via cyber insurance policy.",
    relatedControls: ["IC-001", "IC-004", "IC-008", "IC-010"],
  },
  {
    riskId: "RISK-002",
    title: "Insider Threat – Unauthorized Data Exfiltration",
    description: "Malicious or negligent insider copies sensitive patron or financial data to personal devices or unauthorized cloud storage.",
    category: "Insider Threat",
    owner: "Information Security",
    likelihood: RiskLikelihood.POSSIBLE,
    impact: RiskImpact.MAJOR,
    velocity: RiskVelocity.MEDIUM,
    inherentScore: 12,
    residualScore: 6,
    treatment: RiskTreatment.MITIGATE,
    treatmentDetails: "Implement DLP controls, monitor privileged access via SIEM, enforce least-privilege access, conduct annual user access reviews.",
    relatedControls: ["IC-005", "IC-006", "IC-011"],
  },
  {
    riskId: "RISK-003",
    title: "Third-Party Vendor Breach Impacting Library Systems",
    description: "A critical SaaS vendor or cloud provider suffers a breach that cascades into the Library's environment via shared credentials or API integrations.",
    category: "Third-Party Risk",
    owner: "Procurement & Security",
    likelihood: RiskLikelihood.POSSIBLE,
    impact: RiskImpact.MAJOR,
    velocity: RiskVelocity.MEDIUM,
    inherentScore: 12,
    residualScore: 9,
    treatment: RiskTreatment.TRANSFER,
    treatmentDetails: "Negotiate security SLAs with critical vendors, obtain SOC 2 Type II reports annually, maintain cyber insurance with third-party coverage. Supply Chain risk program is NOT YET implemented (IC-014 is Not Started).",
    relatedControls: ["IC-014"],
  },
  {
    riskId: "RISK-004",
    title: "Unpatched Critical Vulnerability Exploited",
    description: "A critical CVE (CVSS ≥9.0) is exploited in an internet-facing system before the patch SLA can be met due to operational constraints.",
    category: "Vulnerability Management",
    owner: "Security Operations",
    likelihood: RiskLikelihood.LIKELY,
    impact: RiskImpact.MAJOR,
    velocity: RiskVelocity.FAST,
    inherentScore: 16,
    residualScore: 6,
    treatment: RiskTreatment.MITIGATE,
    treatmentDetails: "Automated scanning with Tenable, virtual patching via WAF for critical internet-facing systems, aggressive 72-hour SLA for critical patches.",
    relatedControls: ["IC-003"],
  },
  {
    riskId: "RISK-005",
    title: "Loss of Critical Data Due to Backup Failure",
    description: "Backup job failures go undetected, resulting in unrecoverable data loss during a disaster recovery scenario.",
    category: "Resilience",
    owner: "Infrastructure Team",
    likelihood: RiskLikelihood.UNLIKELY,
    impact: RiskImpact.CRITICAL,
    velocity: RiskVelocity.SLOW,
    inherentScore: 10,
    residualScore: 3,
    treatment: RiskTreatment.MITIGATE,
    treatmentDetails: "Automated backup verification, quarterly restore tests, backup alerting integrated with PagerDuty, immutable backup copies in separate region.",
    relatedControls: ["IC-008"],
  },
  {
    riskId: "RISK-006",
    title: "Misconfigured Cloud Storage Exposing Sensitive Data",
    description: "Overly permissive S3 bucket or cloud storage ACL inadvertently exposes patron PII or internal documents publicly.",
    category: "Cloud Security",
    owner: "Platform Engineering",
    likelihood: RiskLikelihood.POSSIBLE,
    impact: RiskImpact.MAJOR,
    velocity: RiskVelocity.MEDIUM,
    inherentScore: 12,
    residualScore: 5,
    treatment: RiskTreatment.MITIGATE,
    treatmentDetails: "CSPM tooling for continuous misconfiguration detection, IaC security scanning (Checkov), block public access at organization level, quarterly cloud security reviews.",
    relatedControls: ["IC-005", "IC-009"],
  },
];

// ─── Main Seed Function ────────────────────────────────────────
async function main() {
  console.log("🌱 Starting GRC Platform seed...\n");

  // 1. Create NIST CSF 2.0 Framework
  console.log("📋 Creating NIST CSF 2.0 framework...");
  const nistFramework = await prisma.framework.upsert({
    where: { slug: FrameworkSlug.NIST_CSF_2 },
    update: {},
    create: {
      slug: FrameworkSlug.NIST_CSF_2,
      name: "NIST Cybersecurity Framework",
      version: "2.0",
      description: "The NIST Cybersecurity Framework (CSF) 2.0 provides guidance to industry, government agencies, and other organizations to manage cybersecurity risks. It offers a taxonomy of high-level cybersecurity outcomes that can be used by any organization to better understand, assess, prioritize, and communicate its cybersecurity efforts.",
      publishedAt: new Date("2024-02-26"),
    },
  });

  // 2. Create CIS Controls v8.1 Framework
  console.log("📋 Creating CIS Controls v8.1 framework...");
  const cisFramework = await prisma.framework.upsert({
    where: { slug: FrameworkSlug.CIS_V8_1 },
    update: {},
    create: {
      slug: FrameworkSlug.CIS_V8_1,
      name: "CIS Critical Security Controls",
      version: "8.1",
      description: "CIS Controls v8.1 is a prioritized set of actions that collectively form a defense-in-depth set of best practices that mitigate the most common attacks against systems and networks. The CIS Controls are organized into Implementation Groups (IG1, IG2, IG3) to help organizations prioritize implementation based on their risk profile.",
      publishedAt: new Date("2024-06-01"),
    },
  });

  // 3. Create NIST Requirements
  console.log(`📝 Creating ${nistRequirements.length} NIST CSF 2.0 requirements...`);
  const nistReqMap: Record<string, string> = {};
  for (const req of nistRequirements) {
    const created = await prisma.frameworkRequirement.upsert({
      where: { id: `nist-${req.controlId}` },
      update: { title: req.title, description: req.description },
      create: {
        id: `nist-${req.controlId}`,
        frameworkId: nistFramework.id,
        ...req,
        weight: 1,
      },
    });
    nistReqMap[req.controlId] = created.id;
  }

  // 4. Create CIS Requirements
  console.log(`📝 Creating ${cisRequirements.length} CIS Controls v8.1 requirements...`);
  const cisReqMap: Record<string, string> = {};
  for (const req of cisRequirements) {
    const created = await prisma.frameworkRequirement.upsert({
      where: { id: `cis-${req.controlId}` },
      update: { title: req.title, description: req.description },
      create: {
        id: `cis-${req.controlId}`,
        frameworkId: cisFramework.id,
        ...req,
      },
    });
    cisReqMap[req.controlId] = created.id;
  }

  // 5. Create Internal Controls with mappings
  console.log(`🔗 Creating ${internalControls.length} internal controls with cross-framework mappings...`);
  for (const ctrl of internalControls) {
    const { nistMappings, cisMappings, ...controlData } = ctrl;
    const control = await prisma.internalControl.upsert({
      where: { controlCode: controlData.controlCode },
      update: { title: controlData.title, description: controlData.description, status: controlData.status },
      create: controlData,
    });

    // NIST mappings
    for (const nistId of nistMappings) {
      const reqId = nistReqMap[nistId];
      if (reqId) {
        await prisma.controlFrameworkMapping.upsert({
          where: { controlId_requirementId: { controlId: control.id, requirementId: reqId } },
          update: {},
          create: { controlId: control.id, requirementId: reqId },
        });
      }
    }

    // CIS mappings
    for (const cisId of cisMappings) {
      const reqId = cisReqMap[cisId];
      if (reqId) {
        await prisma.controlFrameworkMapping.upsert({
          where: { controlId_requirementId: { controlId: control.id, requirementId: reqId } },
          update: {},
          create: { controlId: control.id, requirementId: reqId },
        });
      }
    }
  }

  // 6. Create sample risks
  console.log(`⚠️  Creating ${sampleRisks.length} sample risks...`);
  for (const risk of sampleRisks) {
    await prisma.risk.upsert({
      where: { riskId: risk.riskId },
      update: {},
      create: risk,
    });
  }

  console.log("\n✅ Seed complete!");
  console.log(`   • 2 frameworks (NIST CSF 2.0 + CIS v8.1)`);
  console.log(`   • ${nistRequirements.length} NIST CSF 2.0 requirements`);
  console.log(`   • ${cisRequirements.length} CIS Controls v8.1 safeguards`);
  console.log(`   • ${internalControls.length} internal controls (cross-framework mapped)`);
  console.log(`   • ${sampleRisks.length} sample risks`);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

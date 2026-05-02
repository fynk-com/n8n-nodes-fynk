# n8n-nodes-fynk

This is an n8n community node for [fynk](https://fynk.com) — an AI contract management platform for creating, sending, and legally signing documents. It helps legal, finance, sales, and operations teams automate document workflows and capture legally binding e-signatures (SES, AES, QES) with a full audit trail.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/sustainable-use-license/) workflow automation platform.

[Installation](#installation) |
[Operations](#operations) |
[Credentials](#credentials) |
[Compatibility](#compatibility) |
[Usage](#usage) |
[Resources](#resources) |
[Version history](#version-history)

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation.

## Operations

### Document

- **Create From Template** — Create a new document from a fynk template. Supports setting dynamic field values, parties, signatories, and moving the document directly to signing.

## Credentials

You need a fynk API access token to use this node.

1. Log in to your fynk account at [app.fynk.com](https://app.fynk.com)
2. Navigate to **Account Settings → API Integrations → fynk API**
3. Generate an API token — make sure it has the required capabilities (e.g. **Document Manager** for document creation)
4. In n8n, create a new **fynk API** credential and paste the token

## Compatibility

Tested against n8n 2.18. Minimum required version is not yet established — please open an issue if you encounter compatibility problems.

## Usage

- Automatically generate and send **sales contracts**, **proposals**, and **offers** when a deal reaches a certain stage in your CRM
- Create **NDAs**, **data privacy agreements (DPA)**, and **service agreements** from templates without manual effort
- Trigger document signing workflows for **purchase agreements** and **sales purchase agreements** directly from your ERP or CRM
- Capture legally binding signatures — **Simple (SES)**, **Advanced (AES)**, or **Qualified (QES)** — with a tamper-proof audit trail
- Automate document generation for high-volume, repetitive contracts like onboarding agreements or subscription renewals

## Resources

- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
- [fynk API reference](https://app.fynk.com/v1/docs#/)

## Version history

### 0.1.0

Initial release. Supports creating documents from templates.

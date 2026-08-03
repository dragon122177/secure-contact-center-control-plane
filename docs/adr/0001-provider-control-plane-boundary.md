# ADR 0001: Keep provider transport outside RelayOps

- Status: accepted
- Date: 2026-08-03

## Context

The system is based on experience configuring provider-hosted VoIP, VPN/proxy access, agents,
databases, and automation. Claiming that RelayOps implements a carrier, VPN protocol, or media plane
would be inaccurate and would expand the risk surface dramatically.

## Decision

RelayOps is a control plane. It stores provider mappings, routing configuration, access-policy
metadata, events, decisions, automation, and evidence. The external provider carries audio and owns
network tunnels. Billing is excluded.

## Consequences

The repository can demonstrate backend, data, security, and operational engineering honestly. A
real integration needs an adapter and secret rotation, but no media server is required. Provider
availability remains an external dependency.

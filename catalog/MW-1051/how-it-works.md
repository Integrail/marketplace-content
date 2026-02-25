# How it Works: Background Check AI Worker

This AI Worker manages the entire background check process. It initiates checks immediately upon offer acceptance, tracks progress across all verification types, surfaces completed results, and flags any issues requiring review. It ensures no candidate falls through the cracks during the waiting period and keeps all stakeholders informed of status.

## Triggers

- Offer accepted
- candidate information submitted
- results received
- issue flagged

## Agent Orchestration

1. **Initiation Agent**
2. **Tracking Agent**
3. **Results Processing Agent**
4. **Adjudication Agent**
5. **Communication Agent**

## Knowledge Sources

- Check requirements by role/location
- vendor SLAs
- adjudication guidelines
- compliance requirements

## Outputs

- Check initiation confirmations
- status updates
- results summaries
- flagged issue alerts
- clearance confirmations

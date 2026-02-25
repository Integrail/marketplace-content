# How it Works: Subscription Management AI Worker

Handles plan changes and reduces churn through intelligent retention strategies This AI Worker turns every cancellation request into a retention opportunity. It manages all subscription modifications—upgrades, downgrades, plan changes, and cancellations—with sophisticated retention logic. For at-risk customers, it analyzes usage patterns, identifies the right save offer, and presents personalized alternatives. It calculates prorations accurately, applies credits appropriately, and processes changes instantly. The worker improves customer lifetime value by making it easy to stay and hard to leave without feeling trapped.

## Triggers

- Plan change requests
- cancellation requests
- upgrade inquiries
- downgrade requests
- billing cycle changes
- feature additions

## Agent Orchestration

1. **Request Classification Agent**
2. **Account Lookup Agent**
3. **Proration Calculation Agent**
4. **Retention Offer Agent**
5. **Modification Execution Agent**
6. **Confirmation Agent**

## Knowledge Sources

- Subscription plans
- pricing tiers
- proration rules
- retention offers
- feature comparisons
- cancellation policies
- competitor pricing

## Outputs

- Updated subscription records
- proration adjustments
- retention offers
- confirmation emails
- CRM updates
- churn risk flags

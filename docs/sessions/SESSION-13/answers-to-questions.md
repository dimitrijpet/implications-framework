Q-A1 - Well, the guidance should be just a guidance, not interfere in the flow, since we don't have any data, the fields can be filled with "guidance" and tooltips, you know... but if you have data then you don't need guidance since you either know how to use it.. maybe we can discuss this logic, or have tooltips or combination something lijke that.
THe system analyzing would be cool, but for now maybe it's an overkill - KEEP NOTE FOR LATER DEVELOPMENT ONE DAY
Yes the system maybe could show the stayCardsModule but it has to somehow be shown that it can't be active since it doesn't have the xstate structure - should offer to make it xstate also (add xstate structure).. every implciation that doesn't have prerequisites to be shown and connected or has errors should somehow be shown a bit differently (opacity lower or whatever) in the graph..

Q-A3 - don't know actually... I mean the first scan should return results or no results, from there we can guide the user... it all depends if it returns proper or improper data which then has to be adapted.. that's the point.. THe questions, I don't know.. we have to discuss this more in the future.. but something like that...whatever can help us make a basic xstateConfig and define the stuff..


Q-B1 - well probably past tense, actions can live in POMS or separate actions, but I think it's preferable to live inside the UNIT test - then we export the "unit" test as action. So we have action, and if it's aciton and validation, it's unit test..

yes, the rules expectations that must be true when IN this state

Since we're in the add state modals, we can explain the forms - so we have context which is for testData and texts, we have UI implciations which are expectations basically, yes they have to be true

Q-B2 - all in one form... name and platform... don't know actually.. originally I wanted the add to be the same as edit modal.. that would be awesome, you know it scans, if there are no fields it says no fields.. but maybe this way it's better, then we have 2 steps, adding implciation, and then data to it.. yeah.. and if we connect some other node to it, it shoudl reflect inside the context and edit modal, right?
Yes each field has to have a name / type / purpose, yes... we can default to strings or something liek that, or depending on the input (like on edit modal for now)

Q-B3 - well that's what I'm talking.. that can be a simple function like waitForSelector or whatever, and if we add the element that's connected to the screen, we can always have that check...
Hmm interesting, mandatory check... well maybe.. who knows, depends on our flow..
it can probably just be element, since we define the screen, and if we do that, then the POM can be created by itself, right? How is it in my current files? but I think it's best ot keep it on elements, , but maybe also allow writting the full selector (if there is no POM element or screen)

Q-C1 - well we can have warnings and errors, it's just that some of them seem redundant for the state.. we really need to go through this.. no need to show that the element is lonely and offer to connect to other element if there is NO OTHER element.. or stuf like that...


Q-D2 - well, it depends on the expectations.. As I saw in my existing Implications files (booking especially) the context are the values that we use in the mirrorsOn and expectations? that's the basic point. testData is needed or not, but if it's needed in expectation, then it has to be added as part of the context - we really need to get this through. we use xstate for testData management, maybe that's why we also added context. yes, copy from context if needed

Q-F2 - maybe best if testData copies to context.. that way we know that the testData is used inside the context for check.. as I understand context is used for checks? those can be also i18n references explicitly (maybe best)... we really need to discuss this..

Q-G2 - yes, didn't we have like xstate and made it like that because we wanted to handle the delta for the testData? the delta is important. but the context accumulates across one test, the required testData becomes bigger and bigger the more stuff we check (since it's needed)

well we validate whenever we say that we want to validate something with expectImplication or whatever the name of the function is.. but the prerequisites have to be validated, if nothing just validating the state or the triggerActions implication or something? that way we can know where it failed or what it's missing... We could make that system (or already have it somewhere in our booking repo) that goes backwards and validates what is needed - PLEASE KEEP A NOTE TO SHOW YOU THIS OR ADD IT TO CONTEXT OF PROJECT!!

Q-H1 - can be just action, but basically it has standalone action + implication, that's why I call it unit test.. but inside implications, the point is that the action is always called... I call it unit because it's one or more actions that induce a particular state - that way we can then have implications of that state (dancer is registered, but blocked, or whatever). Sure we can name better, maybe PerformLogin-UNIT.spec.js
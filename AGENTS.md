we have the following coral reef survey IDs:
    soneva_hb_20250710
    soneva_hb_20250728
    soneva_ootbm_20250624
    soneva_ootbm_20250703
    soneva_ootbr_20250709
    soneva_ootbr_20250728
    soneva_ootsl1_20250602
    soneva_ootsl1_20250620
    soneva_ootsr2_20250702
    soneva_ootsr2_20250704
    soneva_ootsr3_20250703
    soneva_ootsr3_20250704

they are in the public gcs bucket in the folder gs://wildflow/<ID>/mesh_ortho_xyz/

e.g. metadata is here:
https://storage.googleapis.com/wildflow/soneva_ootbm_20250624/mesh_ortho_xyz/metadata.json

subfolder o: /Users/nsv/GitHub/wildflow-3d-orthos/app/o already has implementation of the viewer of orthos using leaflet
we can use that folder as a reference

our goal is to implement new folder oo which would allow comparing orthos, e.g.:

http://localhost:3000/oo/soneva_hb_20250710&soneva_hb_20250728 (you can use alternative delimeter othat than &)

basically we'd have a viewer of two orthos, with delimeter in the middle which we can move left or right
and on the left we show soneva_hb_20250710 and on the right we show soneva_hb_20250728

can you please do that?

**Coding:**
- If you want to test a hypothesis, simply run one-liner in js or python
- When using python you always need to create venv and activate it and then run whatever you want there
- Avoid creating new files, unless absolutely necessary
- Leave no comments (except documentation), all code needs to be short and and easy to read
- The best part is no part - be very aggressive in removing code, never add more than we actually need.
- Zero defencive logic! No try/catch statements unless absolutely necessary. Let things break. Use asserts to assert your assumptions, that's encouraged.
- Do not write me README or SETUP_INSTRUCTIONS etc unless explicitly asked.
- Each reply in the chat must be very breef, and 100x specific. 99% of the time no more than one sentence summary.
- Once you wrote some code, think deeply how we can make it shorter and cleaner. Less code less problems.
- Bias to removing things!
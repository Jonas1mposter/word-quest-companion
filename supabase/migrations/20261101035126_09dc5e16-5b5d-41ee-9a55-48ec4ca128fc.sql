UPDATE public.kill_sound_packs SET sound_urls = jsonb_build_array(
'/__l5e/assets-v1/9dd69640-928e-4709-b943-5c840ce451ff/singularity_1.mp3',
'/__l5e/assets-v1/3a6153eb-d6b2-4b02-83d4-50afdd948ee1/singularity_2.mp3',
'/__l5e/assets-v1/9d811b99-829d-4530-8b5a-94018e5a9f45/singularity_3.mp3',
'/__l5e/assets-v1/76e08510-842b-4119-87b8-02149d651878/singularity_4.mp3',
'/__l5e/assets-v1/8cfa8103-dfb0-43cb-b487-e47103a0952b/singularity_5.mp3',
'/__l5e/assets-v1/5e588e52-7bf6-49f2-9514-ee846781bce1/singularity_6.mp3')
WHERE code = 'singularity';
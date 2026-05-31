-- Optional: seed D1 with the demo family for persistent/queryable demo data.
-- The app already serves this dataset from bundled seed (shared/seed.ts); this
-- mirror is here for when you want the records living in D1.

INSERT OR REPLACE INTO families (id, name, home_town, state, plan, motto) VALUES
  ('fam_hollis', 'The Hollis Family', 'Stephenville', 'TX', 'Arena Pro',
   'Feed before sunrise. Ride like it''s the last eight seconds.');

INSERT OR REPLACE INTO contestants (id, family_id, first_name, last_name, age, division, associations, disciplines, back_number, bio) VALUES
  ('c_rylee','fam_hollis','Rylee','Hollis',16,'Senior','["NHSRA","NLBRA"]','["Barrel Racing","Breakaway Roping"]','117','Junior at Stephenville High chasing a state finals barrel spot.'),
  ('c_cade','fam_hollis','Cade','Hollis',13,'Junior','["NJHRA"]','["Tie-Down Roping","Team Roping"]','44','Seventh grader, first one to the practice pen.'),
  ('c_sissy','fam_hollis','Maelaina','Hollis',8,'Pee Wee','["NLBRA"]','["Barrel Racing","Goat Tying","Dummy Roping"]','8','Runs Peanut as fast as his little legs go.');

INSERT OR REPLACE INTO horses (id, family_id, rider_id, name, barn_name, breed, age, color, bloodlines, role, trainer, farrier_due, vet_due, vax_current, insured, notes, record) VALUES
  ('h_dolly','fam_hollis','c_rylee','Famous Dolly Whiz','Dolly','Quarter Horse',9,'Sorrel','Frenchmans Guy x Dash Ta Fame','Barrel mare','Kasey Worrell','2026-06-09','2026-07-11',1,1,'Loves deep ground.','2D average winner'),
  ('h_chex','fam_hollis','c_cade','Smart Little Chex','Chex','Quarter Horse',10,'Buckskin','Smart Little Lena','Tie-down / heel horse','Self','2026-06-03','2026-07-30',0,0,'Coggins expires before State.','Junior tie-down');

INSERT OR REPLACE INTO arenas (id, name, city, state, status, years_active, threat, story, signatures, signature_goal, economic_impact, supporters) VALUES
  ('a3','Jackson Hole Rodeo Grounds','Jackson','WY','threatened',80,'Rezoning for housing ahead of a 2026 lease expiration','A grassroots campaign gathered 1,300+ signatures. The fight is live.',1340,5000,3400000,920),
  ('a2','Sand Springs Rodeo Arena','Sand Springs','OK','saved',60,'City council voted to close (2017) — community fought back and won','Residents packed the council chambers and kept the arena open.',4200,4000,850000,1180);

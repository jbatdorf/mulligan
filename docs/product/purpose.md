# Purpose of mulligan

mulligan is a social media app that allows you to rank golf courses, track your playing history, and find new courses.

## High Level Data Model
TODO
See [data model doc](./data-models.md)

## MVP Features
- Auth & Identity
  - ability to sign up via phone/email
- User profiles
  - can be private or public, public by default
  - non-users cannot see posts
- Rank a golf course (scale 0-10, generated via ranking system described under "Ratings" data section)
  - add pictures
  - add score
- Search for a golf course
  - goes along with ranking a golf course, you need to be able to search it to rank it
- Ability to add friends/follow people
- Activity feed (chronological only)
- Personal course leaderboard

## Additional Features
- stickers/achievements for playing different courses
  - ex: play courses in 10 different states you get "traveler 1" 
  - ex: play 10 courses in 1 state you get "{state} master 1" badge
- global leaderboard based on some metric


## Outstanding Q's
how to reconcile posts vs. ratings? is ratings an object of its own?
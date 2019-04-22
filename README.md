# VaporPad

## Project Overview

This was a group project in the Winter Semester of 2019 for a Distributed Systems Course and UM Dearborn.  Our group developed a lightweight collaborative text editor modeled on EtherPad.  It allows users to create an account, create notes, share notes, and edit them in real time alongside other users.   A video demonstrating the functionality of the project is available at the following link.
https://youtu.be/Kwa39vGP9fA

## Project Team

Team members:
- Lisa Agastine
- Joshua Caldwell
- Mark Ferrall

## Project Architecture

The editor uses a simple client server architecture as shown below.  The server uses Node.js, the database is a MongoDB database, and the client front end is a simple page using Javascript, HTML and CSS.
![clientServerArch](https://github.com/mferrall/VaporPad/blob/master/images/architecture.png)

## Maintaining Consensus

The primary technical challenge of the project was the implementation of an algorithm that maintains consensus between the clients and the server when collaborating on a document. To meet the acceptance criteria of the project, the application needed to support:
- Clients ability to edit their local copy of a document at all times. At no point should they wait or be blocked while a message from the server is being incorporated
- Distribution of a clients edits to all other clients in real time if the network is available
- Maintaining local edits until the connection is restored or times out if the network is not available
- Incorporation of external edits upon receipt, while maintaining the integrity and consistency of those edits across all clients and the server

## Operational Transformation

This project uses Operational Transformation as the foundation for its approach to maintaining consensus. Operational transformation supports concurrency control between copies of a document on multiple client machines. The messages passed between clients contain the instructions to alter the document from the most recent state available to the sender, in this application, the sender is the client to the server, or the server to the clients.

The figure below provides a high level overview of operational transformation.  In this case, both User 1 and User 2 start with the same word, ‘HAT’.  User 1 modifies the word by inserting ‘C’ at position 0, creating the word ‘CHAT’, and User 2 makes a concurrent edit, deleting ‘H’ in the 0 position, creating the word chat.  Both users send their respective edits to each other, but now the local state of the text has changed, and the operation must be transformed.  To account for its insertion of ‘C’ at position 0, User 1 transforms User 2’s edit to delete the letter at the 1 position.  User 2 does not transform User 1’s edit, as the previous delete operation did not cause a shift in the 0 position.  Applying operational transformation, both users end with the word ‘CAT’.

![OT](https://github.com/mferrall/VaporPad/blob/master/images/OT%20Example.png)

## Further Information

For further information regarding the project, please view the [project report](https://github.com/mferrall/VaporPad/blob/master/report/Final%20Dist%20Systems%20Report.pdf)

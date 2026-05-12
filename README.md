# Maze-Intelligence-Visualizer

1.)Safa Mashita (5025241022)

2.)Acquirell Kriswanto (5025241035)

3.)Via Hana Nurma Putri (5025241048)

An interactive, cinematic web-based educational tool designed to visualize and compare graph traversal algorithms. Built as an exploration of the **Design & Analysis of Algorithms (DAA)**, this project turns abstract computer science concepts into a tangible, playable experience.

## Features

* **Interactive Storytelling:** A landing experience that teaches the fundamental concepts of graphs, queues, stacks, and priority queues before you even enter the labyrinth.
* **Algorithm Visualizer:** Watch algorithms solve dynamically generated mazes in real-time. Features step-by-step controls and adjustable animation speeds.
  * **Breadth-First Search (BFS):** Guarantees the shortest path in unweighted graphs using a FIFO Queue.
  * **Depth-First Search (DFS):** Explores deep into dead ends and backtracks using a LIFO Stack.
  * **Dijkstra's Algorithm:** Finds the cheapest path through weighted terrain using a Min-Heap Priority Queue.
* **Player Mode:** Traverse the graph manually using your arrow keys. Features a "Hint" system that runs a real-time BFS from your current position to the exit.
* **Side-by-Side Comparison:** Run BFS, DFS, and Dijkstra simultaneously to compare path length, total execution steps, and the number of visited nodes.
* **Cinematic UI/UX:** Features an earthy "ruins" aesthetic, dynamic dust particle rendering (Canvas API), and optional ambient wind audio generated via the Web Audio API.

## Tech Stack

This project is built entirely with vanilla web technologies. No external frameworks or libraries were used.
* **HTML5:** Semantic structure and accessible interactive elements.
* **CSS3:** Custom properties, grid/flexbox layouts, CSS animations, and complex gradients for the cinematic UI.
* **Vanilla JavaScript (ES6+):** Logic for recursive backtracker maze generation, graph traversal algorithms, DOM manipulation, Min-Heap implementation, and custom Canvas/Audio loops.

## How to Run

Since this project uses pure HTML/CSS/JS, running it is incredibly simple:

1. Clone the repository:
   ```bash
   git clone https://github.com/hanaavia/maze-intelligence-visualizer.git

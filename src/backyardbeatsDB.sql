use backyardbeatsDB;

CREATE TABLE districts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(50) NOT NULL,
  `email` varchar(100) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `role` enum('fan','artist','admin') NOT NULL DEFAULT 'fan',
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`),
  UNIQUE KEY `email` (`email`)
);

CREATE TABLE artists (
  id INT PRIMARY KEY,
  display_name VARCHAR(100) NOT NULL,
  bio TEXT,
  photo_url VARCHAR(255),
  lat DECIMAL(9,6),
  lng DECIMAL(9,6),
  district_id INT,
  avg_rating DECIMAL(3,2),
  has_upcoming_event BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (district_id) REFERENCES districts(id)
);

CREATE TABLE tracks (
  id INT PRIMARY KEY,
  artist_id INT,
  title VARCHAR(255) NOT NULL,
  preview_url VARCHAR(255),
  duration INT,
  FOREIGN KEY (artist_id) REFERENCES artists(id)
);

CREATE TABLE events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  event_date DATETIME,
  artist_id INT,
  district_id INT,
  FOREIGN KEY (artist_id) REFERENCES artists(id),
  FOREIGN KEY (district_id) REFERENCES districts(id)
);

CREATE TABLE ratings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  artist_id INT,
  user_id INT,
  rating INT CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (artist_id) REFERENCES artists(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Genres and moods as many-to-many (optional, can be normalized further)
CREATE TABLE genres (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE artist_genres (
  artist_id INT,
  genre_id INT,
  PRIMARY KEY (artist_id, genre_id),
  FOREIGN KEY (artist_id) REFERENCES artists(id),
  FOREIGN KEY (genre_id) REFERENCES genres(id)
);

CREATE TABLE moods (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE artist_moods (
  artist_id INT,
  mood_id INT,
  PRIMARY KEY (artist_id, mood_id),
  FOREIGN KEY (artist_id) REFERENCES artists(id),
  FOREIGN KEY (mood_id) REFERENCES moods(id)
);
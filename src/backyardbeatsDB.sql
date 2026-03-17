//src/backyardbeatsDB.sql
use backyard_beats;
use backyardbeatsDB;

CREATE TABLE districts (
  id INT AUTO_INCREMENT PRIMARY KEY, 
  name VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(50) NOT NULL,
  `email` varchar(100) NOT NULL,
  `district_id` int DEFAULT NULL,
  `password_hash` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `role` enum('fan','artist','admin') NOT NULL DEFAULT 'fan',
  `has_profile` tinyint(1) DEFAULT '0',
  `banned` tinyint(1) NOT NULL DEFAULT '0',
  `deleted_at` timestamp NULL DEFAULT NULL,
  `deleted_by` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`),
  UNIQUE KEY `email` (`email`),
  KEY `idx_users_deleted_at` (`deleted_at`),
  KEY `fk_users_deleted_by` (`deleted_by`),
  KEY `fk_users_district` (`district_id`),
  CONSTRAINT `fk_users_deleted_by` FOREIGN KEY (`deleted_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_users_district` FOREIGN KEY (`district_id`) REFERENCES `districts` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `artists` (
  `id` int NOT NULL AUTO_INCREMENT,
  `display_name` varchar(100) NOT NULL,
  `bio` text,
  `photo_url` varchar(255) DEFAULT NULL,
  `lat` decimal(9,6) DEFAULT NULL,
  `lng` decimal(9,6) DEFAULT NULL,
  `avg_rating` decimal(3,2) DEFAULT NULL,
  `has_upcoming_event` tinyint(1) DEFAULT '0',
  `is_approved` tinyint(1) NOT NULL DEFAULT '0',
  `is_rejected` tinyint(1) NOT NULL DEFAULT '0',
  `approved_at` timestamp NULL DEFAULT NULL,
  `rejected_at` timestamp NULL DEFAULT NULL,
  `approved_by` int DEFAULT NULL,
  `rejected_by` int DEFAULT NULL,
  `rejection_reason` varchar(512) DEFAULT NULL,
  `user_id` int DEFAULT NULL,
  `follower_count` int NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `fk_artists_user` (`user_id`),
  KEY `idx_artists_is_pending` (`is_approved`,`is_rejected`),
  CONSTRAINT `fk_artists_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `tracks` (
  `id` int NOT NULL,
  `artist_id` int DEFAULT NULL,
  `title` varchar(255) NOT NULL,
  `preview_url` varchar(255) DEFAULT NULL,
  `duration` int DEFAULT NULL,
  `preview_artwork` varchar(512) DEFAULT NULL,
  `genre` varchar(100) DEFAULT NULL,
  `release_date` date DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `is_approved` tinyint(1) NOT NULL DEFAULT '0',
  `is_rejected` tinyint(1) NOT NULL DEFAULT '0',
  `approved_at` timestamp NULL DEFAULT NULL,
  `rejected_at` timestamp NULL DEFAULT NULL,
  `approved_by` int DEFAULT NULL, 
  `rejected_by` int DEFAULT NULL,
  `rejection_reason` varchar(512) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `tracks_ibfk_1` (`artist_id`),
  KEY `idx_tracks_is_pending` (`is_approved`,`is_rejected`),
  CONSTRAINT `tracks_ibfk_1` FOREIGN KEY (`artist_id`) REFERENCES `artists` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `events` (
  `id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(255) NOT NULL,
  `description` text,
  `event_date` datetime DEFAULT NULL,
  `artist_id` int DEFAULT NULL,
  `district_id` int DEFAULT NULL,
  `venue` varchar(255) DEFAULT NULL,
  `address` varchar(512) DEFAULT NULL,
  `ticket_url` varchar(512) DEFAULT NULL,
  `image_url` varchar(512) DEFAULT NULL,
  `lat` decimal(9,6) DEFAULT NULL,
  `lng` decimal(9,6) DEFAULT NULL,
  `capacity` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `is_approved` tinyint(1) NOT NULL DEFAULT '0',
  `is_rejected` tinyint(1) NOT NULL DEFAULT '0',
  `approved_at` timestamp NULL DEFAULT NULL,
  `rejected_at` timestamp NULL DEFAULT NULL,
  `approved_by` int DEFAULT NULL,
  `rejected_by` int DEFAULT NULL,
  `rejection_reason` varchar(512) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `district_id` (`district_id`),
  KEY `events_ibfk_1` (`artist_id`),
  KEY `idx_events_is_pending` (`is_approved`,`is_rejected`),
  CONSTRAINT `events_ibfk_1` FOREIGN KEY (`artist_id`) REFERENCES `artists` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `events_ibfk_2` FOREIGN KEY (`district_id`) REFERENCES `districts` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `ratings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `artist_id` int DEFAULT NULL,
  `user_id` int DEFAULT NULL,
  `rating` int DEFAULT NULL,
  `comment` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_artist_user` (`artist_id`,`user_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `ratings_ibfk_1` FOREIGN KEY (`artist_id`) REFERENCES `artists` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `ratings_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `ratings_chk_1` CHECK (((`rating` >= 1) and (`rating` <= 5)))
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `genres` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(50) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `artist_genres` (
  `artist_id` int NOT NULL,
  `genre_id` int NOT NULL,
  PRIMARY KEY (`artist_id`,`genre_id`),
  KEY `genre_id` (`genre_id`),
  CONSTRAINT `artist_genres_ibfk_1` FOREIGN KEY (`artist_id`) REFERENCES `artists` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `artist_genres_ibfk_2` FOREIGN KEY (`genre_id`) REFERENCES `genres` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `moods` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(50) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `artist_moods` (
  `artist_id` int NOT NULL,
  `mood_id` int NOT NULL,
  PRIMARY KEY (`artist_id`,`mood_id`),
  KEY `mood_id` (`mood_id`),
  CONSTRAINT `artist_moods_ibfk_1` FOREIGN KEY (`artist_id`) REFERENCES `artists` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `artist_moods_ibfk_2` FOREIGN KEY (`mood_id`) REFERENCES `moods` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `rsvps` (
  `id` int NOT NULL AUTO_INCREMENT,
  `event_id` int NOT NULL,
  `user_id` int NOT NULL,
  `status` enum('going','interested','not_going') NOT NULL DEFAULT 'going',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ux_event_user` (`event_id`,`user_id`),
  KEY `idx_user` (`user_id`),
  KEY `idx_event` (`event_id`),
  CONSTRAINT `fk_rsvps_event` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_rsvps_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `playlists` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `playlists_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `playlist_tracks` (
  `id` int NOT NULL AUTO_INCREMENT,
  `playlist_id` int NOT NULL,
  `track_id` int NOT NULL,
  `position` int NOT NULL DEFAULT '0',
  `added_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ux_playlist_track` (`playlist_id`,`track_id`),
  KEY `track_id` (`track_id`),
  CONSTRAINT `playlist_tracks_ibfk_1` FOREIGN KEY (`playlist_id`) REFERENCES `playlists` (`id`) ON DELETE CASCADE,
  CONSTRAINT `playlist_tracks_ibfk_2` FOREIGN KEY (`track_id`) REFERENCES `tracks` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `listens` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `track_id` int DEFAULT NULL,
  `artist_id` int DEFAULT NULL,
  `played_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `ip` varchar(45) DEFAULT NULL,
  `user_agent` text,
  PRIMARY KEY (`id`),
  KEY `idx_listens_user_played` (`user_id`,`played_at`),
  KEY `idx_listens_track` (`track_id`),
  KEY `idx_listens_artist` (`artist_id`),
  CONSTRAINT `fk_listens_artist` FOREIGN KEY (`artist_id`) REFERENCES `artists` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_listens_track` FOREIGN KEY (`track_id`) REFERENCES `tracks` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_listens_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `favorites` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `artist_id` int NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ux_user_artist` (`user_id`,`artist_id`),
  KEY `fk_favorites_user` (`user_id`),
  KEY `fk_favorites_artist` (`artist_id`),
  CONSTRAINT `fk_favorites_artist` FOREIGN KEY (`artist_id`) REFERENCES `artists` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_favorites_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `support_tickets` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `subject` varchar(255) NOT NULL,
  `body` text NOT NULL,
  `type` enum('appeal','bug','question','other') DEFAULT 'other',
  `target_type` enum('track','event','artist','none') DEFAULT 'none',
  `target_id` bigint unsigned DEFAULT NULL,
  `status` enum('open','pending','resolved','closed','spam') DEFAULT 'open',
  `priority` enum('low','normal','high') DEFAULT 'normal',
  `assignee_id` bigint unsigned DEFAULT NULL,
  `is_read` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `status` (`status`),
  KEY `target_type` (`target_type`,`target_id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `support_messages` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `ticket_id` bigint unsigned NOT NULL,
  `sender_user_id` bigint unsigned DEFAULT NULL,
  `sender_role` enum('user','admin','system') DEFAULT 'user',
  `body` text NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `ticket_id` (`ticket_id`),
  KEY `sender_user_id` (`sender_user_id`),
  CONSTRAINT `support_messages_ibfk_1` FOREIGN KEY (`ticket_id`) REFERENCES `support_tickets` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `support_attachments` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `message_id` bigint unsigned DEFAULT NULL,
  `ticket_id` bigint unsigned DEFAULT NULL,
  `filename` varchar(255) NOT NULL,
  `path` varchar(1024) NOT NULL,
  `mime` varchar(100) DEFAULT NULL,
  `size` int unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `ticket_id` (`ticket_id`),
  KEY `message_id` (`message_id`),
  CONSTRAINT `support_attachments_ibfk_1` FOREIGN KEY (`message_id`) REFERENCES `support_messages` (`id`) ON DELETE CASCADE,
  CONSTRAINT `support_attachments_ibfk_2` FOREIGN KEY (`ticket_id`) REFERENCES `support_tickets` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `terms_and_conditions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(255) NOT NULL,
  `body` text NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `privacy_policies` (
  `id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(255) NOT NULL,
  `body` text NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- districts (28)
INSERT IGNORE INTO districts (name) VALUES
('Chitipa'),
('Karonga'),
('Rumphi'),
('Nkhata Bay'),
('Mzimba'),
('Likoma'),
('Dedza'),
('Dowa'),
('Kasungu'),
('Lilongwe'),
('Mchinji'),
('Nkhotakota'),
('Ntcheu'),
('Ntchisi'),
('Salima'),
('Balaka'),
('Blantyre'),
('Chikwawa'),
('Chiradzulu'),
('Machinga'),
('Mangochi'),
('Mulanje'),
('Mwanza'),
('Nsanje'),
('Thyolo'),
('Phalombe'),
('Zomba'),
('Neno');

-- moods (~10)
INSERT IGNORE INTO moods (name) VALUES
('energetic'),
('melancholic'),
('chill'),
('happy'),
('romantic'),
('aggressive'),
('upbeat'),
('soulful'),
('laid-back'),
('party');

-- genres (~10)
INSERT IGNORE INTO genres (name) VALUES
('afropop'),
('amapiano'),
('gospel'),
('hip hop'),
('r&b'),
('reggae'),
('dancehall'),
('jazz'),
('rock'),
('traditional');

INSERT INTO `terms_and_conditions` (`title`, `body`, `is_active`)
VALUES (
  'BackyardBeats Terms & Conditions',
  CONCAT(
    '<h1>BackyardBeats Terms and Conditions</h1>',
    '<p><strong>Effective date:</strong> ', CURDATE(), '</p>',

    '<h2>1. Introduction</h2>',
    '<p>Welcome to BackyardBeats. These Terms and Conditions (\"Terms\") govern your access to and use of the BackyardBeats website, mobile apps, APIs, and related services (collectively, the \"Service\") provided by BackyardBeats (\"we\", \"us\", or \"the Platform\"). By creating an account, using the Service, or otherwise accessing content on the Platform, you agree to be bound by these Terms.</p>',

    '<h2>2. Eligibility</h2>',
    '<p>To use the Service you must be at least 13 years old (or the minimum legal age in your jurisdiction to form a binding contract). If you are under the legal age, a parent or guardian must create and manage the account. By using the Service you represent and warrant that you meet the eligibility requirements and that all information you provide is accurate and complete.</p>',

    '<h2>3. Accounts, Registration and Security</h2>',
    '<ul>',
      '<li><strong>Account information:</strong> When you register, you must provide accurate information. You agree to keep your account credentials confidential and to notify us immediately of any unauthorized use.</li>',
      '<li><strong>Account responsibility:</strong> You are responsible for all activity that occurs under your account. We may suspend or terminate accounts that violate these Terms or that appear compromised.</li>',
    '</ul>',

    '<h2>4. User Content and Licenses</h2>',
    '<p>\"User Content\" means any text, images, audio, video, or other content you upload, submit, or publish on the Platform, including tracks, artwork, event listings, and profile information.</p>',
    '<ul>',
      '<li><strong>Ownership:</strong> You retain ownership of your User Content.</li>',
      '<li><strong>License to BackyardBeats:</strong> By posting User Content you grant BackyardBeats a worldwide, non-exclusive, royalty-free, transferable license to host, store, reproduce, modify, publicly display and distribute your User Content through the Service and to promote the Service. This license is limited to the purposes described in these Terms (including serving content to other users, enabling previews, and promoting the Platform).</li>',
      '<li><strong>Artist content and approval:</strong> Artists may upload content that remains private until approved by the Platform moderation process. Approval does not transfer ownership. We reserve the right to refuse, remove, or restrict content that violates these Terms or applicable law.</li>',
    '</ul>',

    '<h2>5. Content Standards and Prohibited Conduct</h2>',
    '<p>You agree not to use the Service to submit any User Content that:</p>',
    '<ul>',
      '<li>Infringes intellectual property or privacy rights of others;</li>',
      '<li>Is defamatory, obscene, pornographic, hateful, or otherwise unlawful;</li>',
      '<li>Contains viruses, malware, or other harmful code;</li>',
      '<li>Attempts to mislead, impersonate another person, misrepresent affiliations, or conduct fraudulent activity;</li>',
      '<li>Violates export control, sanction, or other applicable laws.</li>',
    '</ul>',
    '<p>We may remove or restrict access to content that violates these standards and may suspend or terminate accounts that repeatedly violate them.</p>',

    '<h2>6. Moderation, Approvals and Appeals</h2>',
    '<p>BackyardBeats operates a moderation and approvals workflow for artist profiles, tracks, and events. Content may be approved, rejected, or removed at our discretion for compliance with these Terms and our policies. If your content is rejected you will generally receive a reason. If you disagree with a moderation decision you may contact support (see Contact section) to request a review or appeal. We do not guarantee reversal of moderation decisions.</p>',

    '<h2>7. Payments, Fees, and Refunds</h2>',
    '<p>Where the Platform offers paid services (such as promoted listings, ticketing, or other paid features), you agree to the payment terms presented at the time of purchase. All payments are final unless otherwise stated. Third-party payment processors may be used; their terms and privacy policies will also apply. BackyardBeats is not responsible for payment processing errors caused by third parties.</p>',

    '<h2>8. Intellectual Property</h2>',
    '<p>All Platform content that is not User Content, including trademarks, logos, software, and text is owned by BackyardBeats or its licensors. You may not use our intellectual property without our prior written permission.</p>',

    '<h2>9. Copyright Policy and DMCA</h2>',
    '<p>If you believe your copyrighted work has been used on BackyardBeats in a way that constitutes copyright infringement, please provide a written notice to our designated agent with the information required by applicable law. We will respond to valid notices and take action where appropriate.</p>',

    '<h2>10. Privacy</h2>',
    '<p>Our Privacy Policy explains how we collect and use personal information. By using the Service you consent to our collection and use of personal information in accordance with the Privacy Policy. The Privacy Policy is available at the Platform or at the support link.</p>',

    '<h2>11. Third Party Links and Content</h2>',
    '<p>The Service may contain links to third-party websites and services that BackyardBeats does not control. We are not responsible for third-party content, practices, or policies. Your interactions with third-party services are between you and that third party.</p>',

    '<h2>12. Disclaimers</h2>',
    '<p>The Service is provided \"as is\" and \"as available\". BackyardBeats disclaims all warranties to the maximum extent permitted by law, including implied warranties of merchantability, fitness for a particular purpose, and non-infringement. We do not guarantee that the Service will be uninterrupted, secure, or error free.</p>',

    '<h2>13. Limitation of Liability</h2>',
    '<p>To the maximum extent permitted by law, in no event will BackyardBeats, its officers, directors, employees, agents, or affiliates be liable for any indirect, incidental, special, punitive, or consequential damages arising out of or in connection with your use of the Service. Our aggregate liability for direct damages will not exceed the greater of (a) the total fees you paid to BackyardBeats in the 12 months preceding the claim, or (b) one hundred United States dollars (USD 100).</p>',

    '<h2>14. Indemnification</h2>',
    '<p>You agree to indemnify and hold BackyardBeats and its affiliates harmless from any claim, loss, liability, or expense (including reasonable legal fees) arising from your breach of these Terms, your User Content, or your violation of applicable law.</p>',

    '<h2>15. Termination</h2>',
    '<p>We may suspend or terminate your account and access to the Service at any time for breach of these Terms, suspected fraudulent activity, or for any reason in our sole discretion. You may delete your account following the procedures in the Platform; certain information may be retained to comply with legal obligations and for legitimate business purposes.</p>',

    '<h2>16. Governing Law and Dispute Resolution</h2>',
    '<p>These Terms are governed by and construed in accordance with the laws of Malawi, without regard to conflict of law principles. Any dispute arising from or relating to these Terms will be resolved in the courts located in Malawi, unless otherwise agreed in writing.</p>',

    '<h2>17. Changes to Terms</h2>',
    '<p>We may modify these Terms from time to time. If we make material changes, we will provide notice via the Platform or email before they take effect. Continued use of the Service after a change constitutes acceptance of the updated Terms.</p>',

    '<h2>18. Notices and Contact</h2>',
    '<p>For questions, support, or legal notices contact us via the Platform Support page at <a href=\"/support\">/support</a> or by email at <a href=\"mailto:support@backyardbeats.example\">support@backyardbeats.example</a>. Replace this address with your real support email.</p>',

    '<h2>19. Miscellaneous</h2>',
    '<ul>',
      '<li>If any provision of these Terms is found invalid or unenforceable, the remaining provisions will remain in full force and effect.</li>',
      '<li>These Terms constitute the entire agreement between you and BackyardBeats regarding the Service and supersede prior agreements.</li>',
    '</ul>',

    '<p><em>Thank you for using BackyardBeats. We are excited to support Malawi artists and audiences.</em></p>'
  ),
  1
);

INSERT INTO `privacy_policies`
(`title`, `body`, `is_active`, `created_at`, `updated_at`)
VALUES (
'BackyardBeats Privacy Policy',

'<h1>BackyardBeats Privacy Policy</h1>

<p><strong>Effective date:</strong> March 13, 2026</p>

<h2>1. Introduction</h2>
<p>BackyardBeats ("we", "us" or "the Platform") respects your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your personal information when you use the BackyardBeats website and services.</p>

<h2>2. Information We Collect</h2>
<ul>
<li><strong>Account data:</strong> name, username, email, district, profile details.</li>
<li><strong>User Content:</strong> tracks, artwork, bios, event listings, messages — content you upload.</li>
<li><strong>Usage data:</strong> actions on the Platform, pages visited, interactions with content.</li>
<li><strong>Device and technical data:</strong> IP address, browser user agent, device identifiers, cookies.</li>
<li><strong>Payment data:</strong> transaction records when purchases occur.</li>
</ul>

<h2>3. How We Use Your Information</h2>
<ul>
<li>Operate and maintain the BackyardBeats platform</li>
<li>Enable artist uploads and music streaming</li>
<li>Provide playlists, favorites, and social features</li>
<li>Process transactions and payments</li>
<li>Communicate notifications and support responses</li>
<li>Improve recommendations and user experience</li>
<li>Prevent abuse and enforce platform policies</li>
</ul>

<h2>4. Information Sharing</h2>
<p>We may share information with:</p>
<ul>
<li>Other users when you publish public content</li>
<li>Service providers such as hosting or payment processors</li>
<li>Authorities when legally required</li>
<li>Business partners in the event of a merger or acquisition</li>
</ul>

<h2>5. Data Retention</h2>
<p>We retain personal data only as long as necessary to provide the service and comply with legal obligations.</p>

<h2>6. Cookies</h2>
<p>BackyardBeats uses cookies and similar technologies to maintain sessions, analyze usage, and improve user experience.</p>

<h2>7. Security</h2>
<p>We implement reasonable technical safeguards to protect user data. However, no online service can guarantee absolute security.</p>

<h2>8. Children</h2>
<p>The platform is not intended for users under 13 years of age.</p>

<h2>9. Changes to this Policy</h2>
<p>We may update this policy periodically. Continued use of the platform indicates acceptance of any updates.</p>

<h2>10. Contact</h2>
<p>If you have questions regarding this Privacy Policy, contact us at:
<a href="mailto:support@backyardbeats.com">support@backyardbeats.com</a></p>

<p><em>This document serves as the privacy policy for BackyardBeats.</em></p>
',

1,
NOW(),
NOW()
);

-- BackyardBeats database – recommended indexes for performance

-- Users table
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_banned ON users(banned);
-- (district_id already indexed via foreign key)

-- Artists table
CREATE INDEX idx_artists_avg_rating ON artists(avg_rating);
CREATE INDEX idx_artists_follower_count ON artists(follower_count);

-- Tracks table
CREATE INDEX idx_tracks_genre ON tracks(genre);
CREATE INDEX idx_tracks_release_date ON tracks(release_date);
CREATE INDEX idx_tracks_created_at ON tracks(created_at);
-- Composite indexes for common queries
CREATE INDEX idx_tracks_artist_approved ON tracks(artist_id, is_approved);
CREATE INDEX idx_tracks_approved_release ON tracks(is_approved, release_date);
CREATE INDEX idx_tracks_approved_created ON tracks(is_approved, created_at);

-- Events table
CREATE INDEX idx_events_event_date ON events(event_date);
CREATE INDEX idx_events_artist_date ON events(artist_id, event_date);
CREATE INDEX idx_events_approved_date ON events(is_approved, event_date);

-- Ratings table – index on user_id (unique index starts with artist_id)
CREATE INDEX idx_ratings_user_id ON ratings(user_id);

-- Playlist_tracks table – index on track_id alone (unique index starts with playlist_id)
CREATE INDEX idx_playlist_tracks_track_id ON playlist_tracks(track_id);

-- Favorites table – index on artist_id (unique index starts with user_id)
CREATE INDEX idx_favorites_artist_id ON favorites(artist_id);

-- Support tickets table
CREATE INDEX idx_support_tickets_assignee ON support_tickets(assignee_id);
CREATE INDEX idx_support_tickets_created ON support_tickets(created_at);
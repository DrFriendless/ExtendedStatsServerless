-- MySQL dump 10.13  Distrib 5.7.22, for Linux (x86_64)
--
-- ------------------------------------------------------
-- Server version	5.6.37-log

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `categories`
--

DROP TABLE IF EXISTS `categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `categories` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name_UNIQUE` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=3946 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `collectiongames`
--

DROP TABLE IF EXISTS `collectiongames`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `collectiongames` (
  `groupindex` int(11) NOT NULL,
  `bggid` int(11) NOT NULL,
  `ckey` int(11) NOT NULL,
  `orderindex` int(11) NOT NULL
) ENGINE=MyISAM DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `collectiongroups`
--

DROP TABLE IF EXISTS `collectiongroups`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `collectiongroups` (
  `groupindex` int(11) NOT NULL,
  `groupname` varchar(128) CHARACTER SET utf8 DEFAULT NULL,
  `groupdesc` varchar(512) CHARACTER SET utf8 DEFAULT NULL,
  `display` tinyint(4) NOT NULL,
  `ckey` int(11) NOT NULL
) ENGINE=MyISAM DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `collections`
--

DROP TABLE IF EXISTS `collections`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `collections` (
  `geek` varchar(128) NOT NULL,
  `collectionname` varchar(256) DEFAULT NULL,
  `description` varchar(512) DEFAULT NULL,
  `collectionindex` int(11) NOT NULL,
  `ckey` int(11) NOT NULL,
  PRIMARY KEY (`ckey`)
) ENGINE=MyISAM DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `designers`
--

DROP TABLE IF EXISTS `designers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `designers` (
  `name` varchar(254) NOT NULL DEFAULT '',
  `bggid` int(11) NOT NULL DEFAULT '0',
  `boring` tinyint(1) DEFAULT '0',
  `url` varchar(254) DEFAULT NULL,
  PRIMARY KEY (`bggid`),
  UNIQUE KEY `bggid_UNIQUE` (`bggid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `downloader`
--

DROP TABLE IF EXISTS `downloader`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `downloader` (
  `starttime` datetime NOT NULL,
  `endtime` datetime NOT NULL,
  `filesprocessed` int(11) NOT NULL,
  `waittime` float NOT NULL,
  `pausetime` float NOT NULL,
  `failures` int(11) NOT NULL,
  `users` int(11) NOT NULL,
  `games` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `expansions`
--

DROP TABLE IF EXISTS `expansions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `expansions` (
  `basegame` int(11) NOT NULL,
  `expansion` int(11) NOT NULL,
  UNIQUE KEY `expansions_unique` (`basegame`,`expansion`),
  KEY `expansions_basegame` (`basegame`),
  KEY `expansions_expansion` (`expansion`),
  CONSTRAINT `fk_expansions_basegame` FOREIGN KEY (`basegame`) REFERENCES `games` (`bggid`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_expansions_expansion` FOREIGN KEY (`expansion`) REFERENCES `games` (`bggid`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `files`
--

DROP TABLE IF EXISTS `files`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `files` (
  `url` varchar(256) NOT NULL,
  `lastUpdate` datetime DEFAULT NULL,
  `processMethod` varchar(128) NOT NULL,
  `nextUpdate` datetime DEFAULT NULL,
  `geek` varchar(128) DEFAULT NULL,
  `tillNextUpdate` varchar(128) DEFAULT NULL,
  `description` varchar(256) DEFAULT NULL,
  `lastattempt` datetime DEFAULT NULL,
  `last_scheduled` datetime DEFAULT NULL,
  `bggid` int(10) DEFAULT NULL,
  `month` int(11) DEFAULT NULL,
  `year` int(11) DEFAULT NULL,
  `geekid` int(11) DEFAULT NULL,
  UNIQUE KEY `files_url_unique` (`url`),
  KEY `files_geek` (`geek`)
) ENGINE=MyISAM DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `game_categories`
--

DROP TABLE IF EXISTS `game_categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `game_categories` (
  `game` int(11) NOT NULL,
  `category` int(11) NOT NULL,
  KEY `category_game` (`game`),
  KEY `category_category` (`category`) USING BTREE,
  CONSTRAINT `fk_game_categories_category` FOREIGN KEY (`category`) REFERENCES `categories` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_game_categories_game` FOREIGN KEY (`game`) REFERENCES `games` (`bggid`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `game_designers`
--

DROP TABLE IF EXISTS `game_designers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `game_designers` (
  `game` int(11) DEFAULT NULL,
  `designer` int(11) DEFAULT NULL,
  KEY `gameDesigners_game` (`game`),
  KEY `gameDesigners_designer` (`designer`),
  CONSTRAINT `fk_game_designers_designer` FOREIGN KEY (`designer`) REFERENCES `designers` (`bggid`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_game_designers_game` FOREIGN KEY (`game`) REFERENCES `games` (`bggid`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `game_mechanics`
--

DROP TABLE IF EXISTS `game_mechanics`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `game_mechanics` (
  `game` int(11) DEFAULT NULL,
  `mechanic` int(11) NOT NULL,
  KEY `mechanic_game` (`game`),
  KEY `fk_game_mechanics_mechanic_idx` (`mechanic`),
  CONSTRAINT `fk_game_mechanics_game` FOREIGN KEY (`game`) REFERENCES `games` (`bggid`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_game_mechanics_mechanic` FOREIGN KEY (`mechanic`) REFERENCES `mechanics` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `game_publishers`
--

DROP TABLE IF EXISTS `game_publishers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `game_publishers` (
  `game` int(11) DEFAULT NULL,
  `publisher` int(11) DEFAULT NULL,
  KEY `gamePublishers_game` (`game`),
  KEY `gamePublishers_publisher` (`publisher`),
  CONSTRAINT `fk_game_publishers_game` FOREIGN KEY (`game`) REFERENCES `games` (`bggid`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_game_publishers_publisher` FOREIGN KEY (`publisher`) REFERENCES `publishers` (`bggid`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `games`
--

DROP TABLE IF EXISTS `games`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `games` (
  `bggid` int(11) NOT NULL DEFAULT '0',
  `name` varchar(256) NOT NULL DEFAULT '',
  `average` float DEFAULT '0',
  `rank` int(11) DEFAULT '-1',
  `yearPublished` int(11) DEFAULT '0',
  `minPlayers` int(10) unsigned DEFAULT '0',
  `maxPlayers` int(10) unsigned DEFAULT '0',
  `playTime` int(10) unsigned DEFAULT '0',
  `usersRated` int(10) unsigned DEFAULT '0',
  `usersTrading` int(10) unsigned DEFAULT '0',
  `usersWanting` int(10) unsigned DEFAULT '0',
  `usersWishing` int(10) unsigned DEFAULT '0',
  `averageWeight` float DEFAULT '0',
  `bayesAverage` float DEFAULT '0',
  `stdDev` float DEFAULT '0',
  `median` float DEFAULT '0',
  `numComments` int(10) unsigned DEFAULT '0',
  `expansion` int(10) unsigned NOT NULL DEFAULT '0',
  `thumbnail` varchar(256) DEFAULT '',
  `usersOwned` int(10) unsigned DEFAULT '0',
  `subdomain` varchar(45) DEFAULT NULL,
  PRIMARY KEY (`bggid`),
  UNIQUE KEY `bggid_UNIQUE` (`bggid`),
  KEY `index3` (`bggid`,`name`(255))
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `geekgames`
--

DROP TABLE IF EXISTS `geekgames`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `geekgames` (
  `geek` varchar(128) NOT NULL DEFAULT '',
  `game` int(10) unsigned NOT NULL DEFAULT '0',
  `rating` float NOT NULL DEFAULT '0',
  `owned` tinyint(1) DEFAULT '0',
  `want` tinyint(1) DEFAULT '0',
  `wish` int(10) unsigned DEFAULT '0',
  `trade` tinyint(1) DEFAULT '0',
  `plays` int(10) unsigned DEFAULT NULL,
  `prevowned` tinyint(1) DEFAULT '0',
  `wanttobuy` tinyint(1) NOT NULL DEFAULT '0',
  `wanttoplay` tinyint(1) NOT NULL DEFAULT '0',
  `preordered` tinyint(1) NOT NULL DEFAULT '0',
  `geekid` int(11) NOT NULL DEFAULT '0',
  UNIQUE KEY `geekgame_geek_game` (`geek`,`game`),
  KEY `geekgame_game` (`game`),
  KEY `geekgame_geek` (`geek`),
  KEY `geek` (`geek`),
  KEY `geekid` (`geekid`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `geekgametags`
--

DROP TABLE IF EXISTS `geekgametags`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `geekgametags` (
  `geek` varchar(128) NOT NULL,
  `game` int(10) unsigned NOT NULL,
  `tag` varchar(128) NOT NULL,
  KEY `geekgametags_game` (`game`),
  KEY `geekgametags_geek` (`geek`),
  KEY `geek` (`geek`)
) ENGINE=MyISAM DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `geeks`
--

DROP TABLE IF EXISTS `geeks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `geeks` (
  `username` varchar(128) NOT NULL DEFAULT '',
  `shouldplay` int(10) unsigned NOT NULL DEFAULT '0',
  `avatar` varchar(256) DEFAULT '',
  `bggid` int(11) NOT NULL DEFAULT '-1',
  `country` varchar(64) DEFAULT NULL,
  `id` int(11) DEFAULT NULL,
  PRIMARY KEY (`username`),
  UNIQUE KEY `id_UNIQUE` (`id`),
  KEY `geek_names` (`id`,`username`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `history`
--

DROP TABLE IF EXISTS `history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `history` (
  `geek` varchar(128) NOT NULL,
  `ts` datetime NOT NULL,
  `friendless` int(11) DEFAULT '-1000',
  `wanted` int(10) unsigned DEFAULT '0',
  `wished` int(10) unsigned DEFAULT '0',
  `owned` int(10) unsigned DEFAULT '0',
  `unplayed` int(10) unsigned DEFAULT '0',
  `distinctPlayed` int(10) unsigned DEFAULT '0',
  `traded` int(10) unsigned DEFAULT '0',
  `nickelPercent` float NOT NULL DEFAULT '0',
  `yourAverage` float NOT NULL DEFAULT '0',
  `percentPlayedEver` float NOT NULL DEFAULT '0',
  `percentPlayedThisYear` float NOT NULL DEFAULT '0',
  `averagePogo` float NOT NULL DEFAULT '0',
  `bggAverage` float NOT NULL DEFAULT '0',
  `curmudgeon` float NOT NULL DEFAULT '0',
  `meanYear` float NOT NULL DEFAULT '0',
  `the100` int(10) unsigned DEFAULT '0',
  `sdj` int(10) unsigned DEFAULT '0',
  `top50` int(10) unsigned DEFAULT '0',
  `totalPlays` int(10) unsigned DEFAULT '0',
  `medYear` int(10) unsigned DEFAULT '0',
  KEY `history_geek` (`geek`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `market`
--

DROP TABLE IF EXISTS `market`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `market` (
  `geek` varchar(128) NOT NULL,
  `gameid` int(10) unsigned NOT NULL,
  `itemid` int(10) unsigned NOT NULL
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `mechanics`
--

DROP TABLE IF EXISTS `mechanics`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `mechanics` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) DEFAULT NULL,
  UNIQUE KEY `id_UNIQUE` (`id`),
  UNIQUE KEY `name_UNIQUE` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=9722 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `metadata`
--

DROP TABLE IF EXISTS `metadata`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `metadata` (
  `ruletype` int(11) NOT NULL,
  `game` int(11) NOT NULL,
  KEY `fk_metadata_game_idx` (`game`),
  CONSTRAINT `fk_metadata_game` FOREIGN KEY (`game`) REFERENCES `games` (`bggid`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `months_played`
--

DROP TABLE IF EXISTS `months_played`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `months_played` (
  `geek` int(11) NOT NULL,
  `month` int(10) unsigned NOT NULL,
  `year` int(10) unsigned NOT NULL,
  UNIQUE KEY `unique_index` (`geek`,`month`,`year`),
  KEY `monthsplayed_geek` (`geek`),
  CONSTRAINT `fk_months_played_geek` FOREIGN KEY (`geek`) REFERENCES `geeks` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `not_games`
--

DROP TABLE IF EXISTS `not_games`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `not_games` (
  `bggid` int(11) NOT NULL,
  PRIMARY KEY (`bggid`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `numplayers`
--

DROP TABLE IF EXISTS `numplayers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `numplayers` (
  `game` int(10) unsigned NOT NULL DEFAULT '0',
  `best1` int(10) unsigned NOT NULL DEFAULT '0',
  `recommended1` int(10) unsigned NOT NULL DEFAULT '0',
  `notrec1` int(10) unsigned NOT NULL DEFAULT '0',
  `best2` int(10) unsigned NOT NULL DEFAULT '0',
  `recommended2` int(10) unsigned NOT NULL DEFAULT '0',
  `notrec2` int(10) unsigned NOT NULL DEFAULT '0',
  `best3` int(10) unsigned NOT NULL DEFAULT '0',
  `recommended3` int(10) unsigned NOT NULL DEFAULT '0',
  `notrec3` int(10) unsigned NOT NULL DEFAULT '0',
  `best4` int(10) unsigned NOT NULL DEFAULT '0',
  `recommended4` int(10) unsigned NOT NULL DEFAULT '0',
  `notrec4` int(10) unsigned NOT NULL DEFAULT '0',
  `best5` int(10) unsigned NOT NULL DEFAULT '0',
  `recommended5` int(10) unsigned NOT NULL DEFAULT '0',
  `notrec5` int(10) unsigned NOT NULL DEFAULT '0',
  `best6` int(10) unsigned NOT NULL DEFAULT '0',
  `best7` int(10) unsigned NOT NULL DEFAULT '0',
  `recommended6` int(10) unsigned NOT NULL DEFAULT '0',
  `recommended7` int(10) unsigned NOT NULL DEFAULT '0',
  `notrec6` int(10) unsigned NOT NULL DEFAULT '0',
  `notrec7` int(10) unsigned NOT NULL DEFAULT '0',
  KEY `numplayers_game` (`game`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `opponents`
--

DROP TABLE IF EXISTS `opponents`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `opponents` (
  `name` varchar(45) DEFAULT NULL,
  `username` varchar(128) DEFAULT NULL,
  `colour` varchar(45) DEFAULT NULL,
  `geek` varchar(128) NOT NULL,
  `month` int(11) NOT NULL,
  `year` int(11) NOT NULL,
  `count` int(11) NOT NULL
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `plays`
--

DROP TABLE IF EXISTS `plays`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `plays` (
  `game` int(11) NOT NULL,
  `geek` int(11) NOT NULL,
  `playDate` date NOT NULL,
  `quantity` int(10) unsigned NOT NULL DEFAULT '1',
  `basegame` int(10) DEFAULT '0',
  `raters` int(11) DEFAULT '0',
  `ratingsTotal` int(11) DEFAULT '0',
  `location` varchar(256) DEFAULT NULL,
  `month` int(11) NOT NULL,
  `year` int(11) NOT NULL,
  KEY `plays_index` (`geek`,`playDate`),
  KEY `plays_games` (`geek`,`game`),
  KEY `plays_game` (`game`),
  KEY `plays_geek` (`geek`),
  CONSTRAINT `fk_plays_geek` FOREIGN KEY (`geek`) REFERENCES `geeks` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `plays_normalised`
--

DROP TABLE IF EXISTS `plays_normalised`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `plays_normalised` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `game` int(11) NOT NULL,
  `geek` int(11) NOT NULL,
  `quantity` int(10) unsigned NOT NULL,
  `year` int(11) NOT NULL,
  `month` int(11) NOT NULL,
  `date` int(11) NOT NULL,
  `expansion_play` int(1) NOT NULL,
  `baseplay` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_plays_normalised_game_idx` (`game`),
  KEY `fk_plays_normalised_geek_idx` (`geek`),
  CONSTRAINT `fk_plays_normalised_game` FOREIGN KEY (`game`) REFERENCES `games` (`bggid`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_plays_normalised_geek` FOREIGN KEY (`geek`) REFERENCES `geeks` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB AUTO_INCREMENT=666284 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `publishers`
--

DROP TABLE IF EXISTS `publishers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `publishers` (
  `name` varchar(254) NOT NULL DEFAULT '',
  `bggid` int(11) NOT NULL DEFAULT '0',
  `url` varchar(254) DEFAULT NULL,
  PRIMARY KEY (`bggid`),
  UNIQUE KEY `bggid_UNIQUE` (`bggid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ranking_table`
--

DROP TABLE IF EXISTS `ranking_table`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `ranking_table` (
  `game` int(11) NOT NULL,
  `game_name` varchar(255) NOT NULL,
  `total_ratings` int(11) NOT NULL DEFAULT '0',
  `num_ratings` int(11) NOT NULL DEFAULT '0',
  `bgg_ranking` int(11) NOT NULL DEFAULT '0',
  `bgg_rating` float NOT NULL,
  `normalised_ranking` int(11) NOT NULL DEFAULT '0',
  `total_plays` int(11) NOT NULL DEFAULT '0',
  PRIMARY KEY (`game`),
  UNIQUE KEY `game_UNIQUE` (`game`),
  CONSTRAINT `fk_ranking_table_game` FOREIGN KEY (`game`) REFERENCES `games` (`bggid`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `series`
--

DROP TABLE IF EXISTS `series`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `series` (
  `series_id` int(11) NOT NULL,
  `game` int(11) NOT NULL,
  KEY `series_game` (`game`),
  KEY `series_name` (`series_id`),
  CONSTRAINT `fk_series_game` FOREIGN KEY (`game`) REFERENCES `games` (`bggid`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_series_id` FOREIGN KEY (`series_id`) REFERENCES `series_metadata` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `series_metadata`
--

DROP TABLE IF EXISTS `series_metadata`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `series_metadata` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=23 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `war_table`
--

DROP TABLE IF EXISTS `war_table`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `war_table` (
  `geek` int(11) NOT NULL DEFAULT '0',
  `totalPlays` int(10) NOT NULL DEFAULT '0',
  `distinctGames` int(10) NOT NULL DEFAULT '0',
  `top50` int(10) NOT NULL DEFAULT '0',
  `sdj` int(10) NOT NULL DEFAULT '0',
  `owned` int(10) NOT NULL DEFAULT '0',
  `want` int(10) NOT NULL DEFAULT '0',
  `wish` int(10) NOT NULL DEFAULT '0',
  `trade` int(10) NOT NULL DEFAULT '0',
  `prevOwned` int(10) NOT NULL DEFAULT '0',
  `friendless` int(10) NOT NULL DEFAULT '0',
  `cfm` float DEFAULT '0',
  `utilisation` float DEFAULT '0',
  `tens` int(10) NOT NULL DEFAULT '0',
  `zeros` int(10) NOT NULL DEFAULT '0',
  `ext100` int(10) NOT NULL DEFAULT '0',
  `hindex` int(10) NOT NULL DEFAULT '0',
  `geekName` varchar(255) NOT NULL,
  `preordered` int(11) NOT NULL DEFAULT '0',
  PRIMARY KEY (`geek`),
  UNIQUE KEY `geek_UNIQUE` (`geek`),
  CONSTRAINT `fk_front_page_geeks_geek` FOREIGN KEY (`geek`) REFERENCES `geeks` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2018-07-22 16:13:32
import React, { Component } from 'react';
import './App.css';
import { Menu } from './Menu';
import { SubMenu } from './model';

class ExtstatsNavbar extends Component {
  render() {

      const bggMenu: SubMenu = { name: 'BGG', style: "nav-bgg", items: [
              { link: "https://boardgamegeek.com/guild/2938", name: "Guild" },
              { link: "https://www.boardgamegeek.com/microbadge/6964", name: "Microbadge" },
              { link: "https://www.boardgamegeek.com/microbadge/33991", name: "Friends" }
          ]};
    return (
        <div role="navigation" className="extstats-navbar">
          <a href="/"><img src="/img/go.png" height="28px"/></a>
          <a className="navbar-button nav-wartable" href="/wartable.html">War Table</a>
          <a className="navbar-button nav-ranking" href="/rankings.html">Rankings</a>
          <a className="navbar-button nav-blog" href="http://blog.drfriendless.com">Blog</a>
          <a className="navbar-button nav-dataprot" href="/dataprotection.html">Privacy</a>
          <Menu name={bggMenu.name} items={bggMenu.items} style={bggMenu.style}/>
          <a className="navbar-button nav-github" href="https://github.com/DrFriendless/ExtendedStatsServerless">Github</a>
          <a className="navbar-button nav-patreon" href="https://www.patreon.com/drfriendless">Patreon</a>
        </div>
    );
  }
}

export default ExtstatsNavbar;

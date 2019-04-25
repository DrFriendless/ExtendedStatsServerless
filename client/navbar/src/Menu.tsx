import { SubMenu } from './model';
import React from 'react';

export function Menu(props: SubMenu) {
    return <div className="navbar-menu">
        <a className={"navbar-button " + props.style}>{props.name}</a>
        <div className="navbar-dropdown">
        {
            props.items.map(item =>
                <a className={"navbar-button " + props.style} href={item.link}>
                    {item.name}
                </a>)
        }
        </div>
    </div>;
}
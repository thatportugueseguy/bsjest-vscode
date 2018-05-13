## Official ReasonReact Migration Script

ReasonReact breaking change releases, if any, are accompanied by this upgrade script and a description of changes [here](https://github.com/reasonml/reason-react/blob/master/HISTORY.md).

### Installation

**Don't forget** to upgrade your reason-react dependency first!

Pick the **right version** of the migration script based on the version of ReasonReact your app is using:

- Upgrading from reason-react 0.3.0 to 0.3.1: `npm install https://github.com/chenglou/upgrade-reason-react\#0.3.0-to-0.3.1`
- Upgrading from reason-react 0.3.1 to 0.4.0: `npm install https://github.com/chenglou/upgrade-reason-react\#0.3.1-to-0.4.0`

and so on. See the [releases page](https://github.com/chenglou/upgrade-reason-react/releases) for all the scripts.

**Notes**:

- If you're e.g. currently on reason-react 0.3.2, you can still use the `#0.3.1-to-0.4.0` script, as there has been no breaking changes in-between reason-react 0.3.1 and 0.4.0.
- You can chain the upgrade scripts one after another to upgrade a really old ReasonReact app onto the newest one; but you can't do it automatically. Some scripts might require some human clean-ups after being run.

### Usage

```sh
./node_modules/upgrade-reason-react/lib/bs/bytecode/migrate.byte MyComponent1.re
```

Where `MyComponent1.re` is the file you want to upgrade. You can also pass a glob, e.g. `src/*.re`, to upgrade multiple files at once.

`npm uninstall upgrade-reason-react` after you're done.

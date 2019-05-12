# Catch up on your favourite image subreddits

This is a simple [node.js](https://nodejs.org) script that will
automatically download all new images posted to your favourite
image subreddits since the last time you checked.

## install the dependencies

You need to have Node.js installed, so if you don't, you probably
want to install that first. Or find a python script somewhere on
github that does the same thing, but the whole reason I wrote this
one is that all the python scripts are ancient and none of them
work either with current Reddit, or Python 3. So... yeah.

`> npm install` or `> yarn install` should both work. The script
needs about 17MB worth of dependencies, which sounds insane until
you remember that Node has no RSS or HTML parsing built in, and
it turns out that good parsers are not tiny. Then again, 17MB is
basically a trivial amount of space in this day and age.

## Running the script

There's not much to say; run it with `> node catch-up` and you're
pretty much done. Except for the step where you'll want to make
sure that the configuration specifies the subreddits you want to
actually catch up on, of course... So read on.

## Setting up your configuration

In order for the catch-up script to work, it needs a config
object to work with, which can be in one of three places:

1. `package.json`
2. `config.json`
3. a file like `config.json` but not called that.

### Using package.json for your configuration

If you don't change anything, then the script will use the
predefined config that is already presupplied in this project's
package.json:

```
{
  "dependencies": {
    "fs-extra": "*",
    "node-fetch": "*",
    "jsdom": "*",
    "rss-parser": "*"
  },
  "config": {
    "subreddits": {
      "birding/new": 0,
      "redpandas/new": 0,
      "naturporn/new": 0
    },
    "domains": [
      "imgur.com",
      "i.redd.it"
    ],
    "downloadPath": "downloads",
    "consolidate": false,
    "exclude": [
      ".gif",
      ".gifv"
    ]
  }
}
```

It's set up to catch you up on bird pictures, pictures
of red pandas, and "nature porn" which is really just
pretty landscape photography.

#### Explaining the configuration options

The obvious meat and potatoes is the `subreddits` list.
Each subreddit has a name with optional subset (though
I can't think of a reason why you'd pick `/top` or `/hot`
rather than `/new`, if you're running a catching-up
script...), and the numbers after each subreddit indicates
the last time the catch-up script ran for that particular
subreddit.

(If you ever want to redownload as far back as reddit will
let you, just set those to `0` before running the script)

The `domains` value is an array of domains that we "know"
are image hosts. If left off, this assumes the same
list as shown above, but maybe your particular subreddits
has a different convention around where images get posted,
in which case you'll want to add that to the domains list.

The `downloadPath` is where the catch-up script will be
writing images to. Note that it will create subdirectories
for each subreddit you have in your list. This value is
optional, it simply assumed "downloads" if you leave it out.

The `consolidate` flag is used to tell the script whether or
not to build subdirectories. When omitted it is assuemd `false`
but when set to `true` all images will be downloaded into the
`downloadPath` directory, rather than into each subreddit's
own subdirectories. This can be useful when one of your
configs is for, say, general nature photography, and you
just want to dump everything into a "playlist" on a digital
picture frame.

Finally, there is an `exclude` array for specifying a list
of file extensions that you don't want downloaded. This value
is optional, and assumes an empty list if you leave it out.

### Using config.json for your configuration

You can, alternatively, create your own default config
by making a file called `config.json` and then putting
the configuration JSON in that:

```
{
  "config": {
    "subreddits": {
      "birding/new": 0,
      "redpandas/new": 0,
      "naturporn/new": 0
    },
    "downloadPath": "./downloads",
    "consolidate": false,
    "exclude": [
      ".gif",
      ".gifv"
    ]
  }
}
```

Running `> node catch-up` will pick this file over
the package.json configuration if it exists.

### Using a custom named config.json

Same as above, except you can give it any name you
want, really. You'll just need to tell the script
to run using that custom config, using a `-c` flag:

```
> node catch-up -c yourfilenamehere
```

This can be useful if you want multiple thematic
catch-up operations. For instance, one `nature.json`
for all your natury photographs, and `aww.json`
for all those puppy and kitten photos.

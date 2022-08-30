Claudéric Demers' excellent dnd-kit sortable tree example, extracted into its own Create-React-App.

I wanted it for app I'm making, but was having trouble extracting it and running it under CRA. Hopefully this will be useful for others looking to do the same.

Source is ripped/adapted as best I could from https://github.com/clauderic/dnd-kit/tree/master/stories/3%20-%20Examples/Tree. I honestly could not get postcss working with CRA, so the `.module.css` files were translated by hand.

This repo is deployed to https://dnd-kit-sortable-tree-example.vercel.app/. Take a look to see what you're getting.

It ought to be identical to https://master--5fc05e08a4a65d0021ae0bf2.chromatic.com/iframe.html?args=&id=examples-tree-sortable--all-features&viewMode=story, which is the Storybook build of the official dnd-kit example. They're identical as far as I can tell, but inconsistencies could exist.

This is not particularly reusable, but it is pretty. I encourage you to copy paste this code into your own apps and mess with it until it's what you want.

export default {
  Query: {
    hello: () => 'Hello World',
    books: () => {
      return [
        {
          title: 'The Awakening',
          author: 'Kate Chopin',
        },
        {
          title: 'City of Glass',
          author: 'Paul Auster',
        },
      ];
    },
  }
}
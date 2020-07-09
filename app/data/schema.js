'use strict'

const { makeExecutableSchema } = require('graphql-tools')
const resolvers = require('./resolvers')

// Define our schema using the GraphQL schema language
const typeDefs = `
  type User {
    id: Int!
    username: String
    email: String!
    edge_username: String
    profile: String
    created_at: String!
    updated_at: String!
    videos: [Video]
  }
  type Token {
    id: Int!
    user_id: Int!
    token: String!
    type: String!
    is_revoked: Int!
    created_at: String!
    updated_at: String!
  }
  type Video {
    id: Int!
    title: String!
    description: String!
    source: String!
    rand: String!
    user_id: Int!
    processed: Int!
    created_at: String!
    updated_at: String!
    user: User!
    videos: [Video]
  }

  type Query {
    allUsers: [User]
    fetchUser(id: Int!): User
    allVideos: [Video]
    fetchVideo(id: Int!): Video
  }
`

module.exports = makeExecutableSchema({ typeDefs, resolvers })
